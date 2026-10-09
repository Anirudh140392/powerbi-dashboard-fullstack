import dayjs from 'dayjs';

/**
 * Check if the request is from a QC user.
 * QC user has qc_user = 1 (or req.user.qcUser === 1).
 * Supports req.user.qcUser, req.user.qc_user, x-qc-user header, or qcUser query param.
 *
 * @param {Object} req Express request object
 * @returns {boolean} True if QC user, false otherwise
 */
export const isQcUser = (req) => {
    if (!req) return false;
    const userQc = req.user?.qcUser ?? req.user?.qc_user ?? req.headers?.['x-qc-user'] ?? req.query?.qcUser;
    return Number(userQc) === 1;
};

/**
 * Get current browser/client date in YYYY-MM-DD format.
 * Prefers x-current-date header or currentDate query param, fallback to server today date.
 *
 * @param {Object} req Express request object
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const getCurrentDate = (req) => {
    let dateStr = req?.headers?.['x-current-date'] || req?.query?.currentDate || req?.query?.current_date;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    return dayjs().format('YYYY-MM-DD');
};

/**
 * Get max allowed data date for the request.
 * QC User -> today's date (current day)
 * Normal User -> today's date minus 1 day (current day - 1)
 *
 * @param {Object} req Express request object
 * @returns {string} Max allowed date string (YYYY-MM-DD)
 */
export const getMaxAllowedDate = (req) => {
    const today = getCurrentDate(req);
    if (isQcUser(req)) {
        return today; // QC user can see up to current day
    }
    return dayjs(today).subtract(1, 'day').format('YYYY-MM-DD'); // Normal user up to current day - 1
};

/**
 * Mutates and returns filters object with QC date restrictions applied.
 * - Adds `filters.isQcUser` (boolean)
 * - Adds `filters.currentDate` (YYYY-MM-DD)
 * - Adds `filters.maxAllowedDate` (YYYY-MM-DD)
 * - Restricts `filters.endDate` to not exceed `maxAllowedDate` for non-QC users
 * - Restricts `filters.startDate` to not exceed `maxAllowedDate` for non-QC users
 * - Restricts `filters.compareEndDate` / `filters.compareStartDate` for non-QC users
 *
 * @param {Object} filters Query/service filters object
 * @param {Object} req Express request object
 * @returns {Object} Updated filters object
 */
export const applyQcDateFilter = (filters = {}, req) => {
    const isQc = isQcUser(req);
    const today = getCurrentDate(req);
    const maxAllowedDate = isQc ? today : dayjs(today).subtract(1, 'day').format('YYYY-MM-DD');

    filters.isQcUser = isQc;
    filters.currentDate = today;
    filters.maxAllowedDate = maxAllowedDate;

    if (!isQc) {
        // Cap endDate to maxAllowedDate (current day - 1)
        if (!filters.endDate || dayjs(filters.endDate).isAfter(dayjs(maxAllowedDate))) {
            filters.endDate = maxAllowedDate;
        }

        // Cap startDate if it's after maxAllowedDate
        if (filters.startDate && dayjs(filters.startDate).isAfter(dayjs(maxAllowedDate))) {
            filters.startDate = maxAllowedDate;
        }

        // Cap comparison dates if present
        if (filters.compareEndDate && dayjs(filters.compareEndDate).isAfter(dayjs(maxAllowedDate))) {
            filters.compareEndDate = maxAllowedDate;
        }
        if (filters.compareStartDate && dayjs(filters.compareStartDate).isAfter(dayjs(maxAllowedDate))) {
            filters.compareStartDate = maxAllowedDate;
        }
    }

    return filters;
};
