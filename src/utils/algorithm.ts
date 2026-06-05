/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Reservation, Machine } from "../types";

/**
 * Convierte un formato HH:MM en minutos totales desde medianoche.
 */
export function timeToMinutes(timeStr: string): number {
  const [hrs, mins] = timeStr.split(":").map(Number);
  return hrs * 60 + mins;
}

/**
 * Convierte minutos totales de medianoche en formato HH:MM.
 */
export function minutesToTime(totalMins: number): string {
  const hrs = Math.floor(totalMins / 60) % 24;
  const mins = totalMins % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Interfaz de respuesta de validación de simultaneidad
 */
export interface SimultaneityValidationResult {
  isConjuntoAllowed: boolean;
  dryingSlotStart: string;
  dryingSlotEnd: string;
  assignedDryerId?: string;
  reason?: string;
  overlappingReservationsCount: number;
  conflictingReservations: Reservation[];
}

/**
 * Algoritmo Crítico de Simultaneidad:
 * Evalúa si se puede reservar un lavarropas con la modalidad "Conjunto" (Lavar + Secar).
 * - Restringe el último lavado Conjunto a las 19:45 (límite operativo estricto de cierre a las 21:00 hs).
 * - Calcula la duración del lavado (36 minutos de ciclo frío/caliente máximo) + 9 minutos de gracia de traslado = 45 minutos.
 * - Por ende, la secadora se bloquea desde la hora de inicio de lavado + 45 minutos.
 * - El ciclo de secado dura 45 minutos.
 * - Verifica si hay alguna secadora (de las 2 en total) que esté disponible durante el intervalo [WashingStart + 45m, WashingStart + 90m].
 * - Si ambas secadoras están ocupadas o reservadas en ese bloque en otra reserva "CONJUNTO", se prohíbe el "Conjunto".
 */
export function validateConjuntoAvailability(
  selectedStartTime: string,
  date: string,
  existingReservations: Reservation[],
  machines: Machine[]
): SimultaneityValidationResult {
  const startMins = timeToMinutes(selectedStartTime);
  
  // 1. Restricción Operativa Horaria General (07:00 a 21:00)
  const opStart = timeToMinutes("07:00");
  const opEnd = timeToMinutes("21:00");
  
  if (startMins < opStart || startMins > opEnd) {
    return {
      isConjuntoAllowed: false,
      dryingSlotStart: "",
      dryingSlotEnd: "",
      overlappingReservationsCount: 0,
      conflictingReservations: [],
      reason: "Fuera de rango operativo. El edificio opera exclusivamente de 07:00 hs a 21:00 hs."
    };
  }

  // 2. Restricción de Cierre de Lavado Conjunto (Último turno de inicio obligatorio 19:45 hs)
  const limitConjuntoMins = timeToMinutes("19:45");
  if (startMins > limitConjuntoMins) {
    return {
      isConjuntoAllowed: false,
      dryingSlotStart: "",
      dryingSlotEnd: "",
      overlappingReservationsCount: 0,
      conflictingReservations: [],
      reason: "Restricción de Cierre: El último turno de lavado Conjunto debe iniciarse a las 19:45 hs para garantizar el desalojo y cierre a las 21:00 hs."
    };
  }

  // 3. Cálculo del rango proyectado para la secadora
  // Lavado dura 36 min max (en caliente/frío) + 9 min gracia de traslado = 45 minutos tras el inicio.
  const dryStartMins = startMins + 45;
  const dryEndMins = dryStartMins + 45; // Ciclo de secado estimado de 45 minutos

  const dryingStartStr = minutesToTime(dryStartMins);
  const dryingEndStr = minutesToTime(dryEndMins);

  // 4. Verificación de Secadoras fuera de servicio
  const activeDryers = machines.filter(m => m.type === "DRYER" && m.status !== "OUT_OF_SERVICE");
  const totalActiveDryersCount = activeDryers.length;

  if (totalActiveDryersCount === 0) {
    return {
      isConjuntoAllowed: false,
      dryingSlotStart: dryingStartStr,
      dryingSlotEnd: dryingEndStr,
      overlappingReservationsCount: 0,
      conflictingReservations: [],
      reason: "Indisponibilidad Física: Ambas secadoras del edificio se encuentran Fuera de Servicio administrativamente."
    };
  }

  // 5. Análisis de colisiones/intersecciones temporales
  // Filtramos reservas vigentes para la misma fecha que utilicen secadora (Tipo "CONJUNTO" o secado explícito)
  const activeDryerReservations = existingReservations.filter(res => 
    res.date === date &&
    res.status !== "CANCELLED" &&
    res.status !== "EXPIRED_NOSHOW" &&
    res.type === "CONJUNTO" &&
    res.secondaryStartTime &&
    res.secondaryEndTime
  );

  const conflictingReservations: Reservation[] = [];
  const preoccupiedDryerIds = new Set<string>();

  for (const res of activeDryerReservations) {
    const resDryStart = timeToMinutes(res.secondaryStartTime!);
    const resDryEnd = timeToMinutes(res.secondaryEndTime!);

    // Dos intervalos de tiempo [A, B] y [C, D] se intersectan si: A < D y C < B
    if (dryStartMins < resDryEnd && resDryStart < dryEndMins) {
      conflictingReservations.push(res);
      if (res.secondaryMachineId) {
        preoccupiedDryerIds.add(res.secondaryMachineId);
      }
    }
  }

  // 6. Evaluación de capacidad
  const overlappingCount = conflictingReservations.length;

  // Si el número de reservas conflictivas en ese intervalo es igual o mayor a las secadoras activas disponibles:
  if (overlappingCount >= totalActiveDryersCount) {
    return {
      isConjuntoAllowed: false,
      dryingSlotStart: dryingStartStr,
      dryingSlotEnd: dryingEndStr,
      overlappingReservationsCount: overlappingCount,
      conflictingReservations,
      reason: `Conflicto de Simultaneidad: Todas las secadoras activas disponibles (${totalActiveDryersCount}) ya están comprometidas para el bloque de secado estimado (${dryingStartStr} - ${dryingEndStr}) por otras ${overlappingCount} reservas.`
    };
  }

  // 7. Asignación automática de la secadora disponible
  // Buscamos cuál de las secadoras activas no está comprometida en ese bloque
  const allDryerIds = activeDryers.map(d => d.id);
  const availableDryerId = allDryerIds.find(id => !preoccupiedDryerIds.has(id)) || allDryerIds[0];

  return {
    isConjuntoAllowed: true,
    dryingSlotStart: dryingStartStr,
    dryingSlotEnd: dryingEndStr,
    assignedDryerId: availableDryerId,
    overlappingReservationsCount: overlappingCount,
    conflictingReservations,
  };
}
