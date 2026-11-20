import {
  createAudit,
  listAudits,
  getAuditById,
  deleteAuditById,
} from '../services/auditService.js';

export const analyzeUrl = async (req, res) => {
  const audit = await createAudit({
    url: req.body.url,
    ownerId: req.clientId,
  });

  res.status(201).json({
    success: true,
    data: audit,
  });
};

export const getAudits = async (req, res) => {
  const { page, limit, search } = req.query;
  const { items, meta } = await listAudits({
    ownerId: req.clientId,
    page,
    limit,
    search,
  });

  res.status(200).json({
    success: true,
    data: items,
    meta,
  });
};

export const getAudit = async (req, res) => {
  const audit = await getAuditById({
    id: req.params.id,
    ownerId: req.clientId,
  });

  res.status(200).json({
    success: true,
    data: audit,
  });
};

export const deleteAudit = async (req, res) => {
  await deleteAuditById({
    id: req.params.id,
    ownerId: req.clientId,
  });

  res.status(204).send();
};
