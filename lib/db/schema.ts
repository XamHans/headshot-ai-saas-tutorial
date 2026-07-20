// db/schema.ts

import * as headshotSchema from '../../modules/headshot/schema';
import * as paymentsSchema from '../../modules/payments/schema';
import * as usersSchema from '../../modules/users/schema';

// Export everything from one place for easy access in your app
const schema = {
  ...usersSchema,
  ...paymentsSchema,
  ...headshotSchema,
};

export default schema;
export * from '../../modules/headshot/schema';
export * from '../../modules/payments/schema';
export * from '../../modules/users/schema';
