import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 0' }}>
          <Section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '32px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {children}
          </Section>
          <Text style={{ color: '#8898aa', fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>
            Perth Class Booking Platform · Perth, Western Australia
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
