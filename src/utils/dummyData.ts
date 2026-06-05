/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Machine, Reservation, FineLog, SystemLog } from "../types";

export const INITIAL_USERS: User[] = [
  {
    id: "U1",
    email: "luciacandelacaceres09@gmail.com",
    fullName: "Lucía Candel Cáceres",
    role: "STUDENT",
    isBlockedByFine: false,
    fineAmountOwed: 0,
    reservationsCountThisWeek: { wash: 1, dry: 1 }
  },
  {
    id: "U2",
    email: "student.resid@un.edu",
    fullName: "Mateo Fernández",
    role: "STUDENT",
    isBlockedByFine: false,
    fineAmountOwed: 0,
    reservationsCountThisWeek: { wash: 0, dry: 0 }
  },
  {
    id: "U3",
    email: "blocked.student@un.edu",
    fullName: "Paula Martínez (Bloqueada)",
    role: "STUDENT",
    isBlockedByFine: true,
    fineAmountOwed: 15.00,
    reservationsCountThisWeek: { wash: 2, dry: 1 } // Already reached wash limit
  },
  {
    id: "U4",
    email: "tutor.adm@residencia.un.edu",
    fullName: "Carlos Bianchi (Tutor)",
    role: "TUTOR",
    isBlockedByFine: false,
    fineAmountOwed: 0,
    reservationsCountThisWeek: { wash: 0, dry: 0 }
  },
  {
    id: "U5",
    email: "tutor2.adm@residencia.un.edu",
    fullName: "Sofía Altieri (Tutora)",
    role: "TUTOR",
    isBlockedByFine: false,
    fineAmountOwed: 0,
    reservationsCountThisWeek: { wash: 0, dry: 0 }
  }
];

export const INITIAL_MACHINES: Machine[] = [
  {
    id: "L1",
    name: "Lavarropas 1",
    type: "WASHER",
    status: "AVAILABLE",
  },
  {
    id: "L2",
    name: "Lavarropas 2",
    type: "WASHER",
    status: "AVAILABLE",
  },
  {
    id: "L3",
    name: "Lavarropas 3",
    type: "WASHER",
    status: "AVAILABLE",
  },
  {
    id: "S1",
    name: "Secarropas 1",
    type: "DRYER",
    status: "AVAILABLE",
  },
  {
    id: "S2",
    name: "Secarropas 2",
    type: "DRYER",
    status: "AVAILABLE",
  }
];

// Let's create some baseline, realistic reservations for "Today" so that the collision/simultaneity conflict checks can be actively tested.
// Let's assume today is June 5, 2026.
const todayStr = "2026-06-05";

export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: "R_PAST_1",
    studentId: "U1",
    studentName: "Lucía Candel Cáceres",
    studentEmail: "luciacandelacaceres09@gmail.com",
    machineId: "L1",
    secondaryMachineId: "S1",
    type: "CONJUNTO",
    date: todayStr,
    startTime: "08:00",
    endTime: "09:15",
    secondaryStartTime: "08:45",
    secondaryEndTime: "09:30",
    status: "COMPLETED",
    createdAt: `${todayStr}T07:15:00Z`,
    qrScannedToStart: true,
    qrScannedToRetrieve: true
  },
  {
    id: "R_CONFLICT_S1",
    studentId: "U2",
    studentName: "Mateo Fernández",
    studentEmail: "student.resid@un.edu",
    machineId: "L2",
    secondaryMachineId: "S1", // Dryer S1 is busy here
    type: "CONJUNTO",
    date: todayStr,
    startTime: "14:00",
    endTime: "15:15",
    secondaryStartTime: "14:45",
    secondaryEndTime: "15:30",
    status: "PENDING",
    createdAt: `${todayStr}T10:00:00Z`,
    qrScannedToStart: false,
    qrScannedToRetrieve: false
  },
  {
    id: "R_CONFLICT_S2",
    studentId: "U3",
    studentName: "Paula Martínez",
    studentEmail: "blocked.student@un.edu",
    machineId: "L3",
    secondaryMachineId: "S2", // Dryer S2 is ALSO busy here!
    type: "CONJUNTO",
    date: todayStr,
    startTime: "14:00",
    endTime: "15:15",
    secondaryStartTime: "14:45",
    secondaryEndTime: "15:30",
    status: "PENDING",
    createdAt: `${todayStr}T11:30:00Z`,
    qrScannedToStart: false,
    qrScannedToRetrieve: false
  }
  // In this setting, both Dryer S1 and S2 are reserved between 14:45 and 15:30.
  // Therefore, if a student tries to book "CONJUNTO" on Washers L1, L2, or L3 for the 14:00 slot, the simulator algorithm
  // will calculate that the required drying window is 14:45 - 15:30.
  // Since BOTH dryers are already committed to S1 and S2 in that block, the option "CONJUNTO" for that slot
  // must be restricted (leaving ONLY "Solo Lavar" available)! Perfect!
];

export const INITIAL_FINE_LOGS: FineLog[] = [
  {
    id: "F1",
    studentId: "U3",
    studentName: "Paula Martínez",
    reservationId: "R_OLD_EXPIRED",
    reason: "NO_SHOW",
    amount: 15.00,
    createdAt: `${todayStr}T07:20:00Z`,
    status: "PENDING"
  }
];

export const INITIAL_SYSTEM_LOGS: SystemLog[] = [
  {
    id: "SL1",
    timestamp: "16:18:00",
    type: "INFO",
    message: "Sistema de gestión inicializado. Rango operativo establecido: 07:00 a 21:00 hs."
  },
  {
    id: "SL2",
    timestamp: "16:18:10",
    type: "INFO",
    message: "Hardware local: 3 Lavarropas de fichas (L1, L2, L3) y 2 Secarropas (S1, S2) detectados."
  }
];

export const PRESET_SLOTS = [
  "07:00", "08:15", "09:30", "10:45", "12:00", 
  "13:15", "14:00", "15:15", "16:30", "17:45", "19:00", "19:45"
];
