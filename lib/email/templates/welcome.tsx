interface WelcomeEmailProps {
  name: string;
  loginUrl?: string;
}

export function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '16px' }}>
        Welcome to our platform, {name}!
      </h1>
      <p style={{ fontSize: '16px', lineHeight: '24px', color: '#666', marginBottom: '24px' }}>
        Thank you for signing up. We're excited to have you on board and can't wait to see what
        you'll build with our AI-powered platform.
      </p>
      {loginUrl && (
        <a
          href={loginUrl}
          style={{
            display: 'inline-block',
            background: '#0D9373',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '500',
            marginBottom: '24px',
          }}
        >
          Get Started
        </a>
      )}
      <p style={{ fontSize: '14px', color: '#999', marginTop: '32px' }}>
        If you have any questions, feel free to reach out to our support team.
      </p>
    </div>
  );
}
