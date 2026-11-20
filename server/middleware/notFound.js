import AppError from '../utils/AppError.js';

const notFound = (req, res, next) => {
  next(new AppError('NOT_FOUND'));
};

export default notFound;

