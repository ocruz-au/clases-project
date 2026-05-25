import { Heading, Hr, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from '../layout';

export interface BookingConfirmationProps {
  studentName: string;
  className: string;
  sessionDate: string;
  sessionTime: string;
  instructorName: string;
  locationName: string;
  locationAddress: string;
  amountPaid: string;
  bookingId: string;
}

export function BookingConfirmationEmail({
  studentName,
  className,
  sessionDate,
  sessionTime,
  instructorName,
  locationName,
  locationAddress,
  amountPaid,
  bookingId,
}: BookingConfirmationProps) {
  return (
    <EmailLayout preview={`Booking confirmed: ${className} on ${sessionDate}`}>
      <Heading style={{ fontSize: '24px', color: '#1a1a2e', marginBottom: '8px' }}>
        Booking Confirmed!
      </Heading>
      <Text style={{ color: '#444', marginBottom: '16px' }}>Hi {studentName},</Text>
      <Text style={{ color: '#444' }}>
        Your booking is confirmed. We look forward to seeing you!
      </Text>
      <Hr style={{ borderColor: '#e8e8e8', margin: '20px 0' }} />
      <Section>
        <Text style={{ fontWeight: 'bold', color: '#1a1a2e', marginBottom: '4px' }}>
          {className}
        </Text>
        <Text style={{ color: '#666', margin: '4px 0' }}>
          Date: {sessionDate} at {sessionTime} (Perth local)
        </Text>
        <Text style={{ color: '#666', margin: '4px 0' }}>Instructor: {instructorName}</Text>
        <Text style={{ color: '#666', margin: '4px 0' }}>
          Location: {locationName}, {locationAddress}
        </Text>
        <Text style={{ color: '#666', margin: '4px 0' }}>Amount paid: {amountPaid}</Text>
      </Section>
      <Hr style={{ borderColor: '#e8e8e8', margin: '20px 0' }} />
      <Text style={{ fontSize: '12px', color: '#999' }}>Booking ID: {bookingId}</Text>
    </EmailLayout>
  );
}
