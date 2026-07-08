interface MagicLinkEmailProps {
  url: string;
}

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '16px' }}>
        Verify your email
      </h1>
      <p style={{ fontSize: '16px', lineHeight: '24px', color: '#666', marginBottom: '24px' }}>
        Click the button below to verify your email and continue setting up your AI headshots. This
        link will expire shortly, so use it soon.
      </p>
      <a
        href={url}
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
        Verify email
      </a>
      <p style={{ fontSize: '14px', color: '#999', marginTop: '32px' }}>
        If the button doesn't work, copy and paste this link into your browser:
        <br />
        <span style={{ wordBreak: 'break-all' }}>{url}</span>
      </p>
      <p style={{ fontSize: '14px', color: '#999', marginTop: '16px' }}>
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  );
}
