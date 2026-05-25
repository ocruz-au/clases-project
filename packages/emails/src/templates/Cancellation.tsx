import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components';

export interface CancellationProps {
  studentName: string;
  className: string;
  sessionDate: string;
  sessionTime: string;
  refundAmountCents: number;
  currency?: string;
  policyNote?: string;
}

export function CancellationEmail({
  studentName,
  className,
  sessionDate,
  sessionTime,
  refundAmountCents,
  currency = 'AUD',
  policyNote,
}: CancellationProps) {
  const hasRefund = refundAmountCents > 0;
  const refundFormatted = `$${(refundAmountCents / 100).toFixed(2)} ${currency}`;

  return (
    <Html>
      <Head />
      <Preview>Your booking for {className} has been cancelled</Preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'Arial, sans-serif' }}>
        <Container
          style={{
            maxWidth: '560px',
            margin: '40px auto',
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '32px',
            border: '1px solid #e0e0e0',
          }}
        >
          <Heading style={{ fontSize: '22px', color: '#1a1a2e', marginBottom: '8px' }}>
            Booking Cancelled
          </Heading>
          <Text style={{ color: '#444', lineHeight: '1.6', marginTop: 0 }}>
            Hi {studentName},
          </Text>
          <Text style={{ color: '#444', lineHeight: '1.6' }}>
            Your booking for <strong>{className}</strong> on {sessionDate} at {sessionTime} (Perth)
            has been cancelled.
          </Text>

          {hasRefund ? (
            <Section
              style={{
                backgroundColor: '#f0fff4',
                border: '1px solid #9ae6b4',
                borderRadius: '6px',
                padding: '16px',
                margin: '20px 0',
              }}
            >
              <Text style={{ color: '#276749', margin: 0, fontWeight: 'bold' }}>
                Refund: {refundFormatted}
              </Text>
              <Text style={{ color: '#276749', margin: '8px 0 0' }}>
                Your refund has been initiated and will appear on your statement within 5–10
                business days.
              </Text>
            </Section>
          ) : (
            <Section
              style={{
                backgroundColor: '#fff5f5',
                border: '1px solid #feb2b2',
                borderRadius: '6px',
                padding: '16px',
                margin: '20px 0',
              }}
            >
              <Text style={{ color: '#c53030', margin: 0 }}>
                No refund applies per the cancellation policy.
              </Text>
            </Section>
          )}

          {policyNote && (
            <Text style={{ color: '#888', fontSize: '13px', marginTop: '8px' }}>
              Policy note: {policyNote}
            </Text>
          )}

          <Text style={{ color: '#444', lineHeight: '1.6', marginTop: '16px' }}>
            We hope to see you again. Browse our upcoming classes any time.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
