interface HeadshotResultsEmailProps {
  url: string;
}

export function HeadshotResultsEmail({ url }: HeadshotResultsEmailProps) {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '16px' }}>
        Your headshots are ready
      </h1>
      <p style={{ fontSize: '16px', lineHeight: '24px', color: '#666', marginBottom: '24px' }}>
        Your payment was successful and your full-resolution headshots are ready to download. Click
        the button below to view and download them.
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
        View your headshots
      </a>
      <p style={{ fontSize: '14px', color: '#999', marginTop: '32px' }}>
        If the button doesn't work, copy and paste this link into your browser:
        <br />
        <span style={{ wordBreak: 'break-all' }}>{url}</span>
      </p>
    </div>
  );
}
