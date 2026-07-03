// db/schema.ts

import * as paymentsSchema from '../../modules/payments/schema';
import * as postsSchema from '../../modules/posts/schema';
import * as usersSchema from '../../modules/users/schema';

// Export everything from one place for easy access in your app
const schema = {
  ...usersSchema,
  ...postsSchema,
  ...paymentsSchema,
};

export default schema;
export * from '../../modules/payments/schema';
export * from '../../modules/posts/schema';
export * from '../../modules/users/schema';
