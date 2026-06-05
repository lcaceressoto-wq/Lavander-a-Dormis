/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = "STUDENT" | "TUTOR";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isBlockedByFine: boolean;
  fineAmountOwed: number;
  reservationsCountThisWeek: {
    wash: number;
    dry: number;
  };
}

export type MachineType = "WASHER" | "DRYER";

export type MachineStatus = "AVAILABLE" | "IN_USE" | "RESERVED" | "OUT_OF_SERVICE" | "RETRIEVAL_PENDING";

export interface Machine {
  id: string; // e.g., "L1", "L2", "L3", "S1", "S2"
  name: string;
  type: MachineType;
  status: MachineStatus;
  currentCycleTimeLeftMinutes?: number; // In-use remaining minutes
  currentCycleTotalMinutes?: number;
  currentUserId?: string;
  currentReservationId?: string;
  cycleSelected?: string; // "Caliente" | "Tibio" | "Frío"
  cycleStartedAt?: string; // ISO string
}

export type ReservationStatus = 
  | "PENDING"          // Reserved but of course starting in future
  | "READY_TO_START"   // Within the turn's first 15 mins (grace period)
  | "IN_PROGRESS"      // Scan completed, currently washing/drying
  | "WAITING_RETRIEVAL"// Cycle ended, but user hasn't scanned to complete retrieval
  | "COMPLETED"        // Clean retrieval scanned
  | "EXPIRED_NOSHOW"   // User didn't show within the 15 mins
  | "CANCELLED";       // Cancelled by student

export type ReservationType = "SOLO_LAVAR" | "CONJUNTO";

export interface Reservation {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  machineId: string; // Washing machine id
  secondaryMachineId?: string; // Drying machine id reserved dynamically for Conjunto
  type: ReservationType;
  date: string; // e.g., "2026-06-05"
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:15"
  secondaryStartTime?: string; // Dryer slot start, e.g. "09:45" (if "Conjunto" was booked at "09:00", washing is 36 min + 9 min grace -> Dryer starts at "09:45" to "10:30")
  secondaryEndTime?: string;
  status: ReservationStatus;
  createdAt: string;
  qrScannedToStart: boolean;
  qrScannedToRetrieve: boolean;
}

export interface FineLog {
  id: string;
  studentId: string;
  studentName: string;
  reservationId: string;
  reason: "NO_SHOW" | "RETRIEVAL_OVERTIME";
  amount: number;
  createdAt: string;
  resolvedAt?: string;
  resolvedByTutorId?: string;
  status: "PENDING" | "PAID";
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: "INFO" | "WARNING" | "SUCCESS" | "CRITICAL";
  message: string;
}
