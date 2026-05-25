import { Button, Heading, Hr, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '../layout';

export interface WaitlistPromotionProps {
  studentName: string;
  className: string;
  sessionDate: string;
  sessionTime: string;
  locationName: string;
  paymentDeadline: string;
  checkoutUrl: string;
}

export function WaitlistPromotionEmail({
  studentName,
  className,
  sessionDate,
  sessionTime,
  locationName,
  paymentDeadline,
  checkoutUrl,
}: WaitlistPromotionProps) {
  return (
    <EmailLayout preview={`Seat available: ${className} — act now!`}>
      <Heading style={{ fontSize: '24px', color: '#1a1a2e', marginBottom: '8px' }}>
        A Seat is Available!
      </Heading>
      <Text style={{ color: '#444', marginBottom: '16px' }}>Hi {studentName},</Text>
      <Text style={{ color: '#444' }}>
        Great news — a seat has opened up for a class you were waitlisted for. Act fast, your
        hold is time-limited!
      </Text>
      <Hr style={{ borderColor: '#e8e8e8', margin: '20px 0' }} />
      <Section>
        <Text style={{ fontWeight: 'bold', color: '#1a1a2e', marginBottom: '4px' }}>
          {className}
        </Text>
        <Text style={{ color: '#666', margin: '4px 0' }}>
          Date: {sessionDate} at {sessionTime} (Perth local)
        </Text>
        <Text style={{ color: '#666', margin: '4px 0' }}>Location: {locationName}</Text>
      </Section>
      <Hr style={{ borderColor: '#e8e8e8', margin: '20px 0' }} />
      <Section style={{ backgroundColor: '#fff8e1', padding: '16px', borderRadius: '6px', marginBottom: '20px' }}>
        <Text style={{ color: '#b45309', fontWeight: 'bold', margin: '0' }}>
          ⏰ Payment deadline: {paymentDeadline} (Perth)
        </Text>
        <Text style={{ color: '#78350f', margin: '8px 0 0' }}>
          If payment is not received by this time, your seat will be offered to the next person
          on the waitlist.
        </Text>
      </Section>
      <Button
        href={checkoutUrl}
        style={{
          backgroundColor: '#1a1a2e',
          color: '#fff',
          padding: '12px 28px',
          borderRadius: '4px',
          textDecoration: 'none',
          display: 'inline-block',
          fontWeight: 'bold',
        }}
      >
        Complete Payment Now
      </Button>
    </EmailLayout>
  );
}
