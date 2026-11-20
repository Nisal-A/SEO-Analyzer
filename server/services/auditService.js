import Audit from '../models/Audit.js';
import AppError from '../utils/AppError.js';
import safeFetch from './fetch/safeFetch.js';
import { analyzePage } from './seo/analyzePage.js';
import { calculateScores } from './scoring/scoreService.js';
import { generateRecommendations } from './recommendationService.js';

const MAX_LIMIT = 50;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// Escapes all regex special characters to prevent ReDoS and regex injection (Master Plan §4, §10).
export const escapeRegex = (rawSearch) =>
  String(rawSearch ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const defaultMongooseRepository = {
  async create(payload) {
    const doc = await Audit.create(payload);
    return doc.toObject();
  },

  async findPaginated({ filter, skip, limit }) {
    const [items, total] = await Promise.all([
      Audit.find(filter).sort({ analyzedAt: -1 }).skip(skip).limit(limit).lean(),
      Audit.countDocuments(filter),
    ]);
    return { items, total };
  },

  async findByIdAndOwner({ id, ownerId }) {
    return Audit.findOne({ _id: id, ownerId }).lean();
  },

  async deleteByIdAndOwner({ id, ownerId }) {
    return Audit.findOneAndDelete({ _id: id, ownerId }).lean();
  },
};

let activeDependencies = {
  repository: defaultMongooseRepository,
  fetcher: safeFetch,
  fetchOptions: {},
};

/**
 * Allows integration tests to inject an in-memory repository and offline test fetcher
 * without changing production route/controller code.
 */
export const setAuditServiceDependencies = (overrides = {}) => {
  activeDependencies = {
    repository: overrides.repository ?? defaultMongooseRepository,
    fetcher: overrides.fetcher ?? safeFetch,
    fetchOptions: overrides.fetchOptions ?? {},
  };
};

export const resetAuditServiceDependencies = () => {
  activeDependencies = {
    repository: defaultMongooseRepository,
    fetcher: safeFetch,
    fetchOptions: {},
  };
};

const parsePositiveIntQuery = (rawValue, defaultValue, fieldName) => {
  if (rawValue === undefined || rawValue === '') return defaultValue;

  const str = String(rawValue).trim();
  if (!/^\d+$/.test(str)) {
    throw new AppError('VALIDATION_ERROR', `Query parameter "${fieldName}" must be a positive integer.`);
  }

  const parsed = Number.parseInt(str, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError('VALIDATION_ERROR', `Query parameter "${fieldName}" must be a positive integer.`);
  }

  return parsed;
};

/**
 * Full analysis pipeline: safeFetch -> analyzePage -> scoreService -> recommendationService -> save Audit.
 * Failed fetches throw before reaching persistence so failed fetches are never stored in v1 (ADR-010).
 *
 * @param {{ url: string, ownerId: string }} params
 * @param {{ repository?: typeof defaultMongooseRepository, fetcher?: typeof safeFetch, fetchOptions?: object }} [options]
 */
export const createAudit = async ({ url, ownerId }, options = {}) => {
  const repository = options.repository ?? activeDependencies.repository;
  const fetcher = options.fetcher ?? activeDependencies.fetcher;
  const fetchOptions = options.fetchOptions ?? activeDependencies.fetchOptions;

  const analysis = await analyzePage(url, { fetcher, fetchOptions });
  const scored = calculateScores(analysis.seoChecks);
  const recommendations = generateRecommendations(scored.seoChecks);

  const auditPayload = {
    schemaVersion: 1,
    ownerId,
    url: analysis.url,
    finalUrl: analysis.finalUrl,
    redirectChain: (analysis.redirectChain ?? []).slice(0, 10),
    responseStatus: analysis.responseStatus,
    status: 'completed',
    analyzedAt: new Date(),
    pageTitle: analysis.pageTitle,
    metaDescription: analysis.metaDescription,
    overallScore: scored.overallScore,
    scoreCoverage: scored.scoreCoverage,
    categoryScores: scored.categoryScores,
    summary: scored.summary,
    seoChecks: scored.seoChecks,
    recommendations,
    details: analysis.details,
  };

  return repository.create(auditPayload);
};

/**
 * Lists audits scoped to `ownerId` with pagination, regex-escaped search, and `analyzedAt: -1` sorting.
 *
 * @param {{ ownerId: string, page?: number | string, limit?: number | string, search?: string }} params
 * @param {{ repository?: typeof defaultMongooseRepository }} [options]
 */
export const listAudits = async ({ ownerId, page, limit, search = '' }, options = {}) => {
  const repository = options.repository ?? activeDependencies.repository;

  const pageNum = parsePositiveIntQuery(page, DEFAULT_PAGE, 'page');
  const rawLimit = parsePositiveIntQuery(limit, DEFAULT_LIMIT, 'limit');
  const effectiveLimit = Math.min(rawLimit, MAX_LIMIT);

  if (search !== undefined && typeof search !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'Query parameter "search" must be a string.');
  }

  const trimmedSearch = String(search ?? '').trim();
  if (trimmedSearch.length > 200) {
    throw new AppError('VALIDATION_ERROR', 'Query parameter "search" cannot exceed 200 characters.');
  }

  const filter = { ownerId };
  if (trimmedSearch.length > 0) {
    const safeRegex = new RegExp(escapeRegex(trimmedSearch), 'i');
    filter.$or = [{ url: safeRegex }, { finalUrl: safeRegex }, { pageTitle: safeRegex }];
  }

  const skip = (pageNum - 1) * effectiveLimit;
  const { items, total } = await repository.findPaginated({
    filter,
    skip,
    limit: effectiveLimit,
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / effectiveLimit);

  return {
    items,
    meta: {
      page: pageNum,
      limit: effectiveLimit,
      total,
      totalPages,
    },
  };
};

/**
 * Retrieves a single saved audit by `_id` and `ownerId`, or throws 404 NOT_FOUND.
 */
export const getAuditById = async ({ id, ownerId }, options = {}) => {
  const repository = options.repository ?? activeDependencies.repository;
  const audit = await repository.findByIdAndOwner({ id, ownerId });

  if (!audit) {
    throw new AppError('NOT_FOUND');
  }

  return audit;
};

/**
 * Deletes a single saved audit by `_id` and `ownerId`, or throws 404 NOT_FOUND.
 */
export const deleteAuditById = async ({ id, ownerId }, options = {}) => {
  const repository = options.repository ?? activeDependencies.repository;
  const deleted = await repository.deleteByIdAndOwner({ id, ownerId });

  if (!deleted) {
    throw new AppError('NOT_FOUND');
  }

  return deleted;
};

export default {
  createAudit,
  listAudits,
  getAuditById,
  deleteAuditById,
  escapeRegex,
  setAuditServiceDependencies,
  resetAuditServiceDependencies,
};
