/**
 * Shared identifiers for the QA billing organisation.
 *
 * In their own module because the seeder runs its work on import, so any script
 * that needed these constants would have re-seeded as a side effect.
 *
 * @cartpos.test addresses cannot reach a real inbox, and the teardown script
 * refuses to delete any user whose address does not end that way.
 */
export const QA_ORG_NAME = 'QA BILLING MART'
export const QA_PASSWORD = 'QaBilling@123' // meets policy: 10+, upper/lower/number/symbol

export const QA_USERS = {
  owner: 'qa-owner@cartpos.test',
  manager: 'qa-manager@cartpos.test',
  cashier1: 'qa-cashier1@cartpos.test',
  cashier2: 'qa-cashier2@cartpos.test',
}
