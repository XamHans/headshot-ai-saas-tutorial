import { describe, it, expect } from 'vitest';

// Test that we can import singletons
describe('Singleton Pattern Verification', () => {
  it('should import postService singleton', async () => {
    const { postService } = await import('@/modules/posts/services/post.service');
    expect(postService).toBeDefined();
    expect(typeof postService.getPosts).toBe('function');
    expect(typeof postService.createPost).toBe('function');
  });

  it('should import userService singleton', async () => {
    const { userService } = await import('@/modules/users/services/user.service');
    expect(userService).toBeDefined();
    expect(typeof userService.createUser).toBe('function');
  });

  it('should import paymentService singleton', async () => {
    const { paymentService } = await import('@/modules/payments/services/payment.service');
    expect(paymentService).toBeDefined();
    expect(typeof paymentService.createPayment).toBe('function');
  });

  it('should import emailService singleton', async () => {
    const { emailService } = await import('@/lib/services/email');
    expect(emailService).toBeDefined();
    expect(typeof emailService.sendEmail).toBe('function');
  });
});

// Test that factory functions still work
describe('Factory Pattern Verification', () => {
  it('should have createPostService factory', async () => {
    const { createPostService } = await import('@/modules/posts/services/post.service');
    expect(createPostService).toBeDefined();
    expect(typeof createPostService).toBe('function');
  });

  it('should have createUserService factory', async () => {
    const { createUserService } = await import('@/modules/users/services/user.service');
    expect(createUserService).toBeDefined();
    expect(typeof createUserService).toBe('function');
  });

  it('should have createPaymentService factory', async () => {
    const { createPaymentService } = await import('@/modules/payments/services/payment.service');
    expect(createPaymentService).toBeDefined();
    expect(typeof createPaymentService).toBe('function');
  });
});
