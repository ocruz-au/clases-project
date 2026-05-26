import { Heading, Hr, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '../layout';

export interface ReminderProps {
  studentName: string;
  className: string;
  sessionDate: string;
  sessionTime: string;
  instructorName: string;
  locationName: string;
  locationAddress: string;
  bookingId: string;
}

export function ReminderEmail({
  studentName,
  className,
  sessionDate,
  sessionTime,
  instructorName,
  locationName,
  locationAddress,
  bookingId,
}: ReminderProps) {
  return (
    <EmailLayout preview={`Reminder: ${className} on ${sessionDate} at ${sessionTime}`}>
      <Heading style={{ fontSize: '24px', color: '#1a1a2e', marginBottom: '8px' }}>
        Class Reminder
      </Heading>
      <Text style={{ color: '#444', marginBottom: '16px' }}>Hi {studentName},</Text>
      <Text style={{ color: '#444' }}>
        Just a reminder that you have a class coming up soon. We look forward to seeing you!
      </Text>
      <Hr style={{ borderColor: '#e8e8e8', margin: '20px 0' }} />
      <Section
        style={{
          backgroundColor: '#f0f7ff',
          border: '1px solid #bee3f8',
          borderRadius: '6px',
          padding: '16px',
          margin: '0 0 20px',
        }}
      >
        <Text style={{ fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 8px' }}>
          {className}
        </Text>
        <Text style={{ color: '#2b6cb0', margin: '4px 0' }}>
          {sessionDate} at {sessionTime} (Perth local)
        </Text>
        <Text style={{ color: '#555', margin: '4px 0' }}>Instructor: {instructorName}</Text>
        <Text style={{ color: '#555', margin: '4px 0' }}>
          Location: {locationName}, {locationAddress}
        </Text>
      </Section>
      <Text style={{ color: '#444' }}>
        Please arrive a few minutes early. If you need to cancel, please do so as soon as possible
        to allow others on the waitlist to attend.
      </Text>
      <Hr style={{ borderColor: '#e8e8e8', margin: '20px 0' }} />
      <Text style={{ fontSize: '12px', color: '#999' }}>Booking ID: {bookingId}</Text>
    </EmailLayout>
  );
}
