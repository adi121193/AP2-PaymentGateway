import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'FrameOS Marketplace - AI Agent Marketplace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #000, #1a1a1a)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '20px',
            }}
          />
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
            }}
          >
            FrameOS
          </h1>
        </div>
        <p
          style={{
            fontSize: '36px',
            color: '#999',
            margin: 0,
            textAlign: 'center',
          }}
        >
          The AI Agent Marketplace
        </p>
        <p
          style={{
            fontSize: '24px',
            color: '#666',
            margin: '20px 0 0 0',
          }}
        >
          Build • Share • Monetize
        </p>
      </div>
    ),
    {
      ...size,
    }
  );
}
