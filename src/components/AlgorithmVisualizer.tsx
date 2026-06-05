/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Reservation, Machine } from "../types";
import { timeToMinutes, minutesToTime, validateConjuntoAvailability } from "../utils/algorithm";
import { AlertTriangle, Clock, Server, CheckCircle2, ShieldCheck, HelpCircle } from "lucide-react";

interface Props {
  selectedStartTime: string;
  existingReservations: Reservation[];
  machines: Machine[];
  onSelectSlot?: (slot: string) => void;
}

export default function AlgorithmVisualizer({
  selectedStartTime,
  existingReservations,
  machines,
  onSelectSlot,
}: Props) {
  const result = validateConjuntoAvailability(selectedStartTime, "2026-06-05", existingReservations, machines);

  // Focus timeline on a critical interval to show overlap: 13:00 to 17:00
  // Convert hours to absolute minutes
  const timelineStart = timeToMinutes("13:00");
  const timelineEnd = timeToMinutes("17:00");
  const timelineDuration = timelineEnd - timelineStart;

  // Let's generate hours markers for the timeline
  const hoursMarkers = ["13:00", "14:00", "15:00", "16:00", "17:00"];

  // Helper to calculate left position & width percentage in the timeline
  const getTimelinePos = (startStr: string, endStr: string) => {
    const startMins = Math.max(timelineStart, timeToMinutes(startStr));
    const endMins = Math.min(timelineEnd, timeToMinutes(endStr));

    if (startMins >= timelineEnd || endMins <= timelineStart) {
      return { show: false, left: "0%", width: "0%" };
    }

    const leftPct = ((startMins - timelineStart) / timelineDuration) * 100;
    const widthPct = ((endMins - startMins) / timelineDuration) * 100;

    return {
      show: true,
      left: `${leftPct}%`,
      width: `${widthPct}%`,
    };
  };

  const activeReservations = existingReservations.filter(
    (r) => r.status !== "CANCELLED" && r.status !== "EXPIRED_NOSHOW" && r.date === "2026-06-05"
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Server size={14} className="text-indigo-600" />
            Veedor de Coincidencias Concurrentes (En Tiempo Real)
          </h4>
          <p className="text-xs text-slate-500">
            Simulación temporal de reservas activas para hoy (13:00 hs - 17:00 hs)
          </p>
        </div>

        {/* Selected slot status badge */}
        <div className="flex items-center gap-2">
          {result.isConjuntoAllowed ? (
            <span className="text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 shrink-0">
              <CheckCircle2 size={13} />
              Conjunto: Disponible en {selectedStartTime} hs
            </span>
          ) : (
            <span className="text-[11px] font-mono font-semibold bg-red-50 text-red-650 px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1.5 shrink-0 text-red-600">
              <AlertTriangle size={13} className="animate-pulse" />
              Conjunto: Bloqueado en {selectedStartTime} hs
            </span>
          )}
        </div>
      </div>

      {/* Rationale explanation banner */}
      <div className={`p-4 rounded-xl border text-xs leading-relaxed transition-all ${
        result.isConjuntoAllowed 
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-red-50 border-red-200 text-red-800"
      }`}>
        <p className="font-semibold mb-1">
          {result.isConjuntoAllowed ? "✓ Lógica Algorítmica Aceptada:" : "✕ Lógica Algorítmica Rechazada:"}
        </p>
        <p className="font-light">
          {result.isConjuntoAllowed 
            ? `La secadora asignada preventivamente para tu bloque complementario (${result.dryingSlotStart} - ${result.dryingSlotEnd}) es la [${result.assignedDryerId}]. Existen únicamente ${result.overlappingReservationsCount} secadoras comprometidas en ese rango.`
            : `${result.reason}`}
        </p>
      </div>

      {/* Visual Timeline Diagram */}
      <div className="space-y-4">
        {/* Timeline Header - Markers */}
        <div className="relative h-6 border-b border-slate-200 text-[10px] font-mono text-slate-550 text-slate-500">
          {hoursMarkers.map((marker) => {
            const leftPct = ((timeToMinutes(marker) - timelineStart) / timelineDuration) * 100;
            return (
              <span
                key={marker}
                className="absolute -translate-x-1/2 font-bold"
                style={{ left: `${leftPct}%` }}
              >
                {marker}
              </span>
            );
          })}
        </div>

        {/* 1. SECTION: WASHERS TRACKS  */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
            Hardware: Lavando ropa (3 Lavarropas independientes)
          </span>

          {["L1", "L2", "L3"].map((washerId) => {
            const hasPrevRes = activeReservations.find(
              (r) => r.machineId === washerId && r.startTime === selectedStartTime
            );
            
            // Check if current user wants to book THIS washer at selectedStartTime
            const showBookingBlock = selectedStartTime !== "";
            const bookingPos = getTimelinePos(selectedStartTime, minutesToTime(timeToMinutes(selectedStartTime) + 36));

            return (
              <div key={washerId} className="relative h-11 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3 group overflow-hidden shadow-2xs">
                <span className="text-xs font-mono text-slate-600 font-bold w-12 z-10 shrink-0">
                  {washerId}
                </span>

                {/* Timeline background container line */}
                <div className="absolute inset-0 left-15 right-0 border-l border-dashed border-slate-200 pointer-events-none"></div>

                {/* Draw existing bookings */}
                {activeReservations
                  .filter((r) => r.machineId === washerId)
                  .map((r, idx) => {
                    const pos = getTimelinePos(r.startTime, r.endTime);
                    if (!pos.show) return null;
                    return (
                      <div
                        key={idx}
                        className="absolute h-6 bg-indigo-50 border border-indigo-200 rounded text-[9px] text-indigo-700 font-mono px-1.5 flex items-center justify-between whitespace-nowrap z-5 truncate font-semibold shadow-xs"
                        style={{ left: `calc(3.75rem + ${pos.left})`, width: pos.width }}
                        title={`${r.studentName}: ${r.startTime} - ${r.endTime} (Wash)`}
                      >
                        <span>{r.studentName.split(" ")[0]} ({r.startTime})</span>
                      </div>
                    );
                  })}

                {/* Project proposed new washing block */}
                {showBookingBlock && bookingPos.show && (
                  <div
                    className="absolute h-8 bg-indigo-50 border border-dashed border-indigo-400 rounded-lg text-[9px] text-indigo-650 font-mono flex items-center justify-center font-bold z-10 pointer-events-none"
                    style={{ left: `calc(3.75rem + ${bookingPos.left})`, width: bookingPos.width }}
                  >
                    <span>Lavar {selectedStartTime}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 2. SECTION: DRYERS TRACKS */}
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block font-bold">
            Hardware Secadoras: (2 Secarropas Físicos)
          </span>

          {["S1", "S2"].map((dryerId) => {
            // Find existing reservations that booked dryerId
            const dryerReservations = activeReservations.filter(
              (r) => r.type === "CONJUNTO" && r.secondaryMachineId === dryerId
            );

            // Project proposed secondary dryer block for Conjunto
            const dryStart = minutesToTime(timeToMinutes(selectedStartTime) + 45); // 36m cycles + 9m grace
            const dryEnd = minutesToTime(timeToMinutes(selectedStartTime) + 90);
            const proposedDryPos = getTimelinePos(dryStart, dryEnd);
            
            // Check if this specific dryer overlaps with proposed block
            const isDryerOverpopulated = dryerReservations.some((res) => {
              const resDryStart = timeToMinutes(res.secondaryStartTime!);
              const resDryEnd = timeToMinutes(res.secondaryEndTime!);
              const propStart = timeToMinutes(dryStart);
              const propEnd = timeToMinutes(dryEnd);
              return propStart < resDryEnd && resDryStart < propEnd;
            });

            return (
              <div key={dryerId} className="relative h-11 bg-slate-50 border border-slate-200 rounded-lg flex items-center px-3 group overflow-hidden shadow-2xs">
                <span className="text-xs font-mono text-slate-600 font-bold w-12 z-10 shrink-0">
                  {dryerId}
                </span>

                {/* Timeline background line */}
                <div className="absolute inset-0 left-15 right-0 border-l border-dashed border-slate-200 pointer-events-none"></div>

                {/* Draw existing Dryer bookings */}
                {dryerReservations.map((r, idx) => {
                  const pos = getTimelinePos(r.secondaryStartTime!, r.secondaryEndTime!);
                  if (!pos.show) return null;
                  return (
                    <div
                      key={idx}
                      className="absolute h-6 bg-slate-100 border border-slate-300 rounded text-[9px] text-slate-600 font-mono px-1.5 flex items-center justify-between whitespace-nowrap z-5 truncate shadow-2xs"
                      style={{ left: `calc(3.75rem + ${pos.left})`, width: pos.width }}
                      title={`${r.studentName}: ${r.secondaryStartTime} - ${r.secondaryEndTime} (Dry)`}
                    >
                      <span className="line-through-none text-slate-600 font-bold">{r.studentName.split(" ")[0]} ({r.secondaryStartTime})</span>
                    </div>
                  );
                })}

                {/* Project proposed dryer block for selected wash start time */}
                {proposedDryPos.show && selectedStartTime !== "" && (
                  <div
                    className={`absolute h-8 rounded-lg text-[9px] font-mono flex items-center justify-center font-bold z-10 pointer-events-none border border-dashed ${
                      isDryerOverpopulated
                        ? "bg-red-50 border-red-400 text-red-600"
                        : result.assignedDryerId === dryerId
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 animate-pulse"
                        : "bg-slate-150 border-slate-300 text-slate-450 text-slate-500 bg-slate-100"
                    }`}
                    style={{ left: `calc(3.75rem + ${proposedDryPos.left})`, width: proposedDryPos.width }}
                  >
                    <span className="px-1 truncate">
                      {isDryerOverpopulated 
                        ? "✕ COLISIONA" 
                        : result.assignedDryerId === dryerId 
                        ? `Secar (${dryStart} - ${dryEnd}) √`
                        : `Ocular Disponible`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Guide Card footer */}
      <div className="flex gap-3 text-[11px] text-slate-600 leading-normal bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
        <Clock size={15} className="text-indigo-600 shrink-0 mt-0.5" />
        <p>
          <strong>Consejo de Prueba:</strong> Selecciona el horario de washing <strong>&quot;14:00&quot;</strong> para presenciar la colisión en vivo. Verás cómo ambas secadoras se bloquean por los turnos previos de Mateo y Paula en la banda horaria de las 14:45 hs, forzando la deshabilitación del paquete Conjunto. Prueba elegir <strong>&quot;15:15&quot;</strong>, y se habilitará libre.
        </p>
      </div>
    </div>
  );
}
