import dns from 'node:dns';
import net from 'node:net';
import AppError from '../../utils/AppError.js';
import { isBlockedIp } from '../../utils/ipClassifier.js';

const defaultDnsResolver = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

const normalizeDnsRecords = (rawRecords) => {
  if (!rawRecords) return [];
  const list = Array.isArray(rawRecords) ? rawRecords : [rawRecords];

  return list
    .map((entry) => {
      if (typeof entry === 'string') {
        const family = net.isIP(entry);
        return family ? { address: entry, family } : null;
      }
      if (entry && typeof entry.address === 'string') {
        const family = entry.family === 4 || entry.family === 6 ? entry.family : net.isIP(entry.address);
        return family ? { address: entry.address, family } : null;
      }
      return null;
    })
    .filter(Boolean);
};

/**
 * Resolves a hostname, verifies that at least one address is returned and that
 * EVERY returned address is public, and builds a pinned `lookup` callback for
 * Node's http.Agent / https.Agent so the socket connects to the validated IP (ADR-006).
 *
 * @param {string} rawHostname
 * @param {{
 *   dnsResolver?: (hostname: string) => Promise<Array<{ address: string, family?: number }>>,
 *   ipChecker?: (ip: string, hostname: string) => boolean
 * }} [options]
 */
export const resolveAndValidateHost = async (rawHostname, options = {}) => {
  if (typeof rawHostname !== 'string' || rawHostname.trim() === '') {
    throw new AppError('INVALID_URL');
  }

  const trimmed = rawHostname.trim().toLowerCase();
  const hostname = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;

  const dnsResolver = options.dnsResolver ?? defaultDnsResolver;
  const ipChecker = options.ipChecker ?? ((ip) => isBlockedIp(ip));

  // If the hostname is already an IP literal, classify it immediately before touching DNS.
  const literalFamily = net.isIP(hostname);
  if (literalFamily !== 0) {
    if (ipChecker(hostname, hostname)) {
      throw new AppError('BLOCKED_URL');
    }
    const pinnedRecord = { address: hostname, family: literalFamily };
    return {
      address: pinnedRecord.address,
      family: pinnedRecord.family,
      allAddresses: [pinnedRecord],
      lookup: createPinnedLookup(pinnedRecord),
    };
  }

  let rawRecords;
  try {
    rawRecords = await dnsResolver(hostname);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('DNS_FAILED');
  }

  const records = normalizeDnsRecords(rawRecords);
  if (records.length === 0) {
    throw new AppError('DNS_FAILED');
  }

  // Reject if ANY resolved address is blocked (prevents multi-A-record bypass).
  for (const record of records) {
    if (ipChecker(record.address, hostname)) {
      throw new AppError('BLOCKED_URL');
    }
  }

  const primary = records[0];

  return {
    address: primary.address,
    family: primary.family,
    allAddresses: records,
    lookup: createPinnedLookup(primary),
  };
};

const createPinnedLookup = (pinnedRecord) => {
  return (_hostname, lookupOptions, callback) => {
    const cb = typeof lookupOptions === 'function' ? lookupOptions : callback;
    const opts = typeof lookupOptions === 'function' ? {} : (lookupOptions ?? {});

    // Node 22 autoSelectFamily passes { all: true } and expects an array of { address, family }.
    if (opts.all) {
      cb(null, [{ address: pinnedRecord.address, family: pinnedRecord.family }]);
      return;
    }

    cb(null, pinnedRecord.address, pinnedRecord.family);
  };
};

export default resolveAndValidateHost;

