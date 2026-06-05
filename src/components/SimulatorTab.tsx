/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  User, Machine, Reservation, FineLog, SystemLog, MachineStatus, ReservationStatus, ReservationType
} from "../types";
import { 
  INITIAL_USERS, INITIAL_MACHINES, INITIAL_RESERVATIONS, INITIAL_FINE_LOGS, INITIAL_SYSTEM_LOGS, PRESET_SLOTS 
} from "../utils/dummyData";
import { 
  timeToMinutes, minutesToTime, validateConjuntoAvailability 
} from "../utils/algorithm";
import AlgorithmVisualizer from "./AlgorithmVisualizer";
import { 
  Smartphone, Shield, UserCheck, AlertTriangle, Play, RefreshCw, LogIn, LogOut, Check, Calendar, Clock, 
  Trash2, QrCode, Wifi, Battery, Send, Plus, Lock, CheckCircle2, ChevronRight, Info, AlertOctagon, HelpCircle 
} from "lucide-react";

export default function SimulatorTab() {
  // --- Simulation Global States ---
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [machines, setMachines] = useState<Machine[]>(INITIAL_MACHINES);
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [fines, setFines] = useState<FineLog[]>(INITIAL_FINE_LOGS);
  const [logs, setLogs] = useState<SystemLog[]>(INITIAL_SYSTEM_LOGS);

  // Time is simulated starting on 2026-06-05 at 13:50 hs so that users can instantly test the 14:00 conflict.
  const [simDate, setSimDate] = useState<string>("2026-06-05");
  const [simTime, setSimTime] = useState<string>("13:50");

  // Logged-in simulated user
  const [currentUser, setCurrentUser] = useState<User | null>(INITIAL_USERS[0]); // Starts logged in as Lucía Candel
  const [loginEmailInput, setLoginEmailInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Form states inside mobile device
  const [selectedMachineId, setSelectedMachineId] = useState<string>("L1");
  const [bookingSlot, setBookingSlot] = useState<string>("15:15");
  const [bookingType, setBookingType] = useState<ReservationType>("SOLO_LAVAR");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Scan QR overlay state
  const [activeScanReservation, setActiveScanReservation] = useState<Reservation | null>(null);
  const [scanType, setScanType] = useState<"START" | "RETRIEVE">("START");
  const [tempCycleSelected, setTempCycleSelected] = useState<"Caliente" | "Tibio" | "Frío">("Tibio");

  // --- Helper to write simulation logs ---
  const addSystemLog = (msg: string, type: "INFO" | "WARNING" | "SUCCESS" | "CRITICAL") => {
    const newLog: SystemLog = {
      id: "SL_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      timestamp: simTime,
      type,
      message: msg
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  // --- Core Expiration State Matcher & Time Advancement ---
  const advanceTimeByMinutes = (minutesToAdd: number) => {
    const curMins = timeToMinutes(simTime);
    const newMins = curMins + minutesToAdd;
    
    // Day rollover (max 24 hours, but we focus on operational hours 07:00 to 21:00)
    const nextTimeStr = minutesToTime(newMins);
    setSimTime(nextTimeStr);
    
    // Check if we hit the operational closing time (21:00 hs)
    const opEndMins = timeToMinutes("21:00");
    if (curMins < opEndMins && newMins >= opEndMins) {
      addSystemLog("⚠️ El lavadero de la residencia ha cerrado (21:00 hs). No se permiten operaciones.", "WARNING");
    }

    addSystemLog(`🕓 El tiempo simulado avanzó +${minutesToAdd} minutos (Ahora son las ${nextTimeStr} hs).`, "INFO");

    // Process State transitions based on advanced time
    setReservations((prevRes) => {
      let updatedRes = [...prevRes];

      // Check each reservation
      updatedRes = updatedRes.map((res) => {
        if (res.status === "CANCELLED" || res.status === "COMPLETED" || res.status === "EXPIRED_NOSHOW") {
          return res;
        }

        const resStartMins = timeToMinutes(res.startTime);
        const resEndMins = timeToMinutes(res.endTime);

        // 1) Transitional READY_TO_START state
        if (res.status === "PENDING" && newMins >= resStartMins && newMins < resStartMins + 15) {
          addSystemLog(`🔔 El turno del lavarropas asignado para ${res.studentName} ha comenzado (${res.startTime} hs). Margen de gracia activo de 15 min.`, "INFO");
          return { ...res, status: "READY_TO_START" };
        }

        // 2) NO-SHOW TRIGGER (Inasistencia penalizada): 15 minutes grace period exceeded
        if ((res.status === "PENDING" || res.status === "READY_TO_START") && newMins >= resStartMins + 15 && !res.qrScannedToStart) {
          addSystemLog(`🚨 INASISTENCIA (No-Show): ${res.studentName} no escaneó el QR dentro de los 15 minutos en lavadora ${res.machineId}.`, "CRITICAL");
          
          // Apply Block and generate fine in database
          setUsers((prevUsers) => 
            prevUsers.map((u) => 
              u.id === res.studentId 
                ? { ...u, isBlockedByFine: true, fineAmountOwed: u.fineAmountOwed + 15.00 } 
                : u
            )
          );

          // Update current user state if they are the ones penalized
          if (currentUser && currentUser.id === res.studentId) {
            setCurrentUser((prev) => prev ? { ...prev, isBlockedByFine: true, fineAmountOwed: prev.fineAmountOwed + 15.00 } : null);
          }

          // Generate Fine Record
          const newFine: FineLog = {
            id: `FINE_${Date.now()}_NS`,
            studentId: res.studentId,
            studentName: res.studentName,
            reservationId: res.id,
            reason: "NO_SHOW",
            amount: 15.00,
            createdAt: `${simDate}T${nextTimeStr}:00Z`,
            status: "PENDING"
          };
          setFines((prevFines) => [newFine, ...prevFines]);

          // Release the occupied machines
          setMachines((prevMachines) => 
            prevMachines.map((m) => 
              m.id === res.machineId || (res.type === "CONJUNTO" && m.id === res.secondaryMachineId)
                ? { ...m, status: "AVAILABLE", currentUserId: undefined, currentReservationId: undefined }
                : m
            )
          );

          return { ...res, status: "EXPIRED_NOSHOW" };
        }

        // 3) IN-PROGRESS cycle countdown decrement
        if (res.status === "IN_PROGRESS") {
          // If a washer is running:
          const washDuration = tempCycleSelected === "Tibio" ? 30 : 36;
          const cycleEndTimeMins = resStartMins + washDuration; // simulated finish

          // If we passed the end time of the booking
          if (newMins >= resEndMins) {
            // Check if dual "Conjunto" is active
            if (res.type === "CONJUNTO" && res.secondaryStartTime && res.secondaryEndTime) {
              const secStart = timeToMinutes(res.secondaryStartTime);
              const secEnd = timeToMinutes(res.secondaryEndTime);

              // Student has transferred clothing to dryer and dryer is running?
              // Standard simulated transition: if time passed secStart but student hasn't retrieved washer,
              // it's an issue. But let's check transition to WAITING_RETRIEVAL for the dryer or washer.
            }

            addSystemLog(`🏁 Ciclo concluido para ${res.studentName}. Margen de gracia de retiro (5 min) iniciado.`, "WARNING");
            
            // Mark machine as retrieval pending
            setMachines((prevM) => 
              prevM.map((m) => 
                m.id === res.machineId
                  ? { ...m, status: "RETRIEVAL_PENDING" }
                  : m
              )
            );

            return { ...res, status: "WAITING_RETRIEVAL" };
          }
        }

        // 4) RETRIEVAL OVERTIME ALARM (5 minutes grace exceeded)
        if (res.status === "WAITING_RETRIEVAL" && newMins >= resEndMins + 5) {
          addSystemLog(`⚠️ RETIRO VENCIDO (Overtime): ${res.studentName} superó los 5 min de gracia para liberar la máquina ${res.machineId}. Alerta enviada a Tutores.`, "CRITICAL");
          
          // Apply Block and generate fine in database
          setUsers((prevUsers) => 
            prevUsers.map((u) => 
              u.id === res.studentId 
                ? { ...u, isBlockedByFine: true, fineAmountOwed: u.fineAmountOwed + 15.00 } 
                : u
            )
          );

          if (currentUser && currentUser.id === res.studentId) {
            setCurrentUser((prev) => prev ? { ...prev, isBlockedByFine: true, fineAmountOwed: prev.fineAmountOwed + 15.00 } : null);
          }

          // Generate Overtime Fine Record
          const newFine: FineLog = {
            id: `FINE_${Date.now()}_OT`,
            studentId: res.studentId,
            studentName: res.studentName,
            reservationId: res.id,
            reason: "RETRIEVAL_OVERTIME",
            amount: 15.00,
            createdAt: `${simDate}T${nextTimeStr}:00Z`,
            status: "PENDING"
          };
          setFines((prevFines) => [newFine, ...prevFines]);

          // VERY CRITICAL RULE: "La máquina se muestra disponible en la app para el siguiente turno"
          // Therefore, the physical machine status is reset to AVAILABLE or left retrieval pending for tutor COMMUNITY bin transfer.
          setMachines((prevMachines) => 
            prevMachines.map((m) => 
              m.id === res.machineId 
                ? { ...m, status: "AVAILABLE", currentUserId: undefined, currentReservationId: undefined }
                : m
            )
          );

          return { ...res, status: "EXPIRED_NOSHOW" }; // Release reservation flow
        }

        return res;
      });

      return updatedRes;
    });

    // Handle Active machine animations or status timers on display
    setMachines((prevM) => 
      prevM.map((m) => {
        if (m.status === "IN_USE" && m.currentCycleTimeLeftMinutes) {
          const decremented = Math.max(0, m.currentCycleTimeLeftMinutes - minutesToAdd);
          if (decremented === 0) {
            return {
              ...m,
              status: "RETRIEVAL_PENDING",
              currentCycleTimeLeftMinutes: undefined
            };
          }
          return {
            ...m,
            currentCycleTimeLeftMinutes: decremented
          };
        }
        return m;
      })
    );
  };

  // --- Student Registration/Login Mock Action ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const trimmed = loginEmailInput.trim().toLowerCase();
    
    // Find in administrative Whitelist database
    const matchedUser = users.find((u) => u.email.toLowerCase() === trimmed);
    if (matchedUser) {
      setCurrentUser(matchedUser);
      addSystemLog(`🔑 Sesión iniciada: ${matchedUser.fullName} (${matchedUser.role}).`, "SUCCESS");
    } else {
      setLoginError("Acceso denegado. Este email no está precargado en las bases de datos escolares.");
      addSystemLog(`🛑 Intento de ingreso fallido: Email no autorizado [${trimmed}].`, "WARNING");
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      addSystemLog(`🚪 Sesión cerrada para: ${currentUser.fullName}`, "INFO");
    }
    setCurrentUser(null);
    setLoginEmailInput("");
  };

  // Switch between preset student accounts to test different limit restrictions
  const switchStudentAccount = (userId: string) => {
    const matched = users.find((u) => u.id === userId);
    if (matched) {
      setCurrentUser(matched);
      addSystemLog(`🔄 Cambio de cuenta de pruebas: Operando como ${matched.fullName}`, "INFO");
    }
  };

  // --- Student Create Reservation Action ---
  const handleCreateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!currentUser) return;

    // 1) Blocked by Fines Check
    if (currentUser.isBlockedByFine) {
      setFormError("✕ Cuenta Bloqueada: No puedes reservar debido a multas físicas impagas de $15.00 con tutoría.");
      addSystemLog(`🛑 Bloqueo reputacional: ${currentUser.fullName} intentó reservar pero tiene multas activas.`, "WARNING");
      return;
    }

    // 2) Weekly limits audit check: "Máximo 2 reservas de lavado y 2 de secado"
    if (bookingType === "SOLO_LAVAR") {
      if (currentUser.reservationsCountThisWeek.wash >= 2) {
        setFormError("✕ Límite Semanal Excedido: Ya has reservado el máximo de 2 lavados para esta semana.");
        return;
      }
    } else if (bookingType === "CONJUNTO") {
      if (currentUser.reservationsCountThisWeek.wash >= 2) {
        setFormError("✕ Límite Semanal Excedido: Ya has alcanzado el límite de 2 lavados semanales.");
        return;
      }
      if (currentUser.reservationsCountThisWeek.dry >= 2) {
        setFormError("✕ Límite Semanal Excedido: Ya has alcanzado el límite de 2 secados semanales con tu cuenta.");
        return;
      }
    }

    // 3) General operational hours check: "07:00 hs a 21:00 hs."
    const selMins = timeToMinutes(bookingSlot);
    const opStart = timeToMinutes("07:00");
    const opEnd = timeToMinutes("21:00");

    if (selMins < opStart || selMins > opEnd) {
      setFormError("✕ Operación restingida: Selección fuera del rango de la residencia (07:00 - 21:00 hs).");
      return;
    }

    // 4) Check physical machine availability & Out of Service
    const selectedMachine = machines.find((m) => m.id === selectedMachineId);
    if (!selectedMachine) return;
    
    if (selectedMachine.status === "OUT_OF_SERVICE") {
      setFormError("✕ Fuera de Servicio: La lavadora seleccionada está apagada por reparación técnica.");
      return;
    }

    // 5) Check for direct booking collision on that exact slot
    const hasConflictOnWasher = reservations.some((r) => 
      r.date === simDate && 
      r.machineId === selectedMachineId && 
      r.startTime === bookingSlot &&
      r.status !== "CANCELLED" &&
      r.status !== "EXPIRED_NOSHOW"
    );

    if (hasConflictOnWasher) {
      setFormError(`✕ Conflicto en Lavadora: El lavarropas ${selectedMachineId} ya está reservado en el slot de las ${bookingSlot} hs por otro estudiante.`);
      return;
    }

    // 6) CRITICAL ALGORITHM VALIDATION FOR CONJUNTO
    let secondaryDryerId: string | undefined;
    let projDryStart = "";
    let projDryEnd = "";

    if (bookingType === "CONJUNTO") {
      const simCheck = validateConjuntoAvailability(bookingSlot, simDate, reservations, machines);
      if (!simCheck.isConjuntoAllowed) {
        setFormError(`✕ Algoritmo de Simultaneidad: ${simCheck.reason}`);
        addSystemLog(`🛑 Inhabilitación de Conjunto: El algoritmo detectó colisión de secadoras en slot ${bookingSlot}.`, "WARNING");
        return;
      }
      secondaryDryerId = simCheck.assignedDryerId;
      projDryStart = simCheck.dryingSlotStart;
      projDryEnd = simCheck.dryingSlotEnd;
    }

    // All checks passed! Proceed to save booking
    const newReservationId = `RES_${Date.now()}_${Math.floor(Math.random() * 100)}`;
    const washEndMins = selMins + 45; // standard duration on timetable

    const newReservation: Reservation = {
      id: newReservationId,
      studentId: currentUser.id,
      studentName: currentUser.fullName,
      studentEmail: currentUser.email,
      machineId: selectedMachineId,
      secondaryMachineId: secondaryDryerId,
      type: bookingType,
      date: simDate,
      startTime: bookingSlot,
      endTime: minutesToTime(washEndMins),
      secondaryStartTime: secondaryDryerId ? projDryStart : undefined,
      secondaryEndTime: secondaryDryerId ? projDryEnd : undefined,
      status: "PENDING",
      createdAt: `${simDate}T${simTime}:00Z`,
      qrScannedToStart: false,
      qrScannedToRetrieve: false
    };

    setReservations((prev) => [...prev, newReservation]);

    // Update user's weekly counts in administration db
    setUsers((prevUsers) => 
      prevUsers.map((u) => {
        if (u.id === currentUser.id) {
          const updatedWash = u.reservationsCountThisWeek.wash + 1;
          const updatedDry = bookingType === "CONJUNTO" ? u.reservationsCountThisWeek.dry + 1 : u.reservationsCountThisWeek.dry;
          return {
            ...u,
            reservationsCountThisWeek: { wash: updatedWash, dry: updatedDry }
          };
        }
        return u;
      })
    );

    // Update locally synchronized current user state
    setCurrentUser((prev) => {
      if (!prev) return null;
      const updatedWash = prev.reservationsCountThisWeek.wash + 1;
      const updatedDry = bookingType === "CONJUNTO" ? prev.reservationsCountThisWeek.dry + 1 : prev.reservationsCountThisWeek.dry;
      return {
        ...prev,
        reservationsCountThisWeek: { wash: updatedWash, dry: updatedDry }
      };
    });

    setFormSuccess(`✓ ¡Reserva confirmada con éxito! Has bloqueado lavarropas ${selectedMachineId} ` + 
      (secondaryDryerId ? `y se bloqueó automáticamente el secarropas ${secondaryDryerId} (${projDryStart} - ${projDryEnd} hs)` : ""));
    addSystemLog(`✓ Reserva creada por ${currentUser.fullName}: ${bookingType} en ${selectedMachineId} a las ${bookingSlot} hs.`, "SUCCESS");
  };

  // --- Student QR Actions Simulators ---
  const handleCancelReservation = (resId: string) => {
    const matched = reservations.find((r) => r.id === resId);
    if (!matched) return;

    // RULE: "Permitidas sin penalización hasta 2 horas antes del turno"
    const currentMins = timeToMinutes(simTime);
    const startMins = timeToMinutes(matched.startTime);

    if (startMins - currentMins < 120) {
      alert(`✕ No permitido: Faltan menos de 2 horas para el inicio del ciclo (${matched.startTime} hs). Se requiere presencia física técnica.`);
      addSystemLog(`🛑 Intento de cancelación tardía por ${matched.studentName} para el turno de las ${matched.startTime} hs.`, "WARNING");
      return;
    }

    setReservations((prev) => 
      prev.map((r) => r.id === resId ? { ...r, status: "CANCELLED" } : r)
    );

    // Return weekly slots allowance
    setUsers((prevUsers) => 
      prevUsers.map((u) => {
        if (u.id === matched.studentId) {
          const updatedWash = Math.max(0, u.reservationsCountThisWeek.wash - 1);
          const updatedDry = matched.type === "CONJUNTO" ? Math.max(0, u.reservationsCountThisWeek.dry - 1) : u.reservationsCountThisWeek.dry;
          return { ...u, reservationsCountThisWeek: { wash: updatedWash, dry: updatedDry } };
        }
        return u;
      })
    );

    if (currentUser && currentUser.id === matched.studentId) {
      setCurrentUser((prev) => {
        if (!prev) return null;
        const updatedWash = Math.max(0, prev.reservationsCountThisWeek.wash - 1);
        const updatedDry = matched.type === "CONJUNTO" ? Math.max(0, prev.reservationsCountThisWeek.dry - 1) : prev.reservationsCountThisWeek.dry;
        return { ...prev, reservationsCountThisWeek: { wash: updatedWash, dry: updatedDry } };
      });
    }

    addSystemLog(`💸 Reserva para las ${matched.startTime} cancelada sin cargo por ${matched.studentName}.`, "INFO");
  };

  const openQrScanner = (res: Reservation, type: "START" | "RETRIEVE") => {
    setActiveScanReservation(res);
    setScanType(type);
  };

  const handleSimulateQrScanSuccess = () => {
    if (!activeScanReservation) return;

    const resId = activeScanReservation.id;
    const isStart = scanType === "START";

    if (isStart) {
      // 1. SCAN DE INICIO DE CICLO
      // Update Reservation Status
      setReservations((prev) => 
        prev.map((r) => 
          r.id === resId 
            ? { ...r, status: "IN_PROGRESS", qrScannedToStart: true } 
            : r
        )
      );

      // Program the Machine Status (e.g. IN_USE)
      const duration = tempCycleSelected === "Tibio" ? 30 : 36;
      setMachines((prevM) => 
        prevM.map((m) => 
          m.id === activeScanReservation.machineId
            ? { 
                ...m, 
                status: "IN_USE", 
                currentUserId: activeScanReservation.studentId, 
                currentReservationId: resId,
                currentCycleTimeLeftMinutes: duration,
                currentCycleTotalMinutes: duration,
                cycleSelected: tempCycleSelected,
                cycleStartedAt: `${simDate}T${simTime}:00Z`
              }
            : m
        )
      );

      addSystemLog(`📲 QR Escaneado: ${activeScanReservation.studentName} activó la máquina ${activeScanReservation.machineId} con el ciclo [${tempCycleSelected} - ${duration} minutos].`, "SUCCESS");
    } else {
      // 2. SCAN DE RETIRO COMPLETADO
      // Update Reservation Status to final Completed
      setReservations((prev) => 
        prev.map((r) => 
          r.id === resId 
            ? { ...r, status: "COMPLETED", qrScannedToRetrieve: true } 
            : r
        )
      );

      // Release Machine
      setMachines((prevM) => 
        prevM.map((m) => 
          m.id === activeScanReservation.machineId
            ? { ...m, status: "AVAILABLE", currentUserId: undefined, currentReservationId: undefined }
            : m
        )
      );

      addSystemLog(`🎁 QR Escaneado: ${activeScanReservation.studentName} confirmó retiro completo. Lavadora ${activeScanReservation.machineId} liberada con éxito.`, "SUCCESS");
    }

    setActiveScanReservation(null);
  };

  // --- Tutor Administration Actions Simulators ---
  const handleCollectFineAndUnlock = (fineId: string) => {
    const matchedFine = fines.find((f) => f.id === fineId);
    if (!matchedFine) return;

    // 1. Mark Fine as PAID
    setFines((prevFines) => 
      prevFines.map((f) => 
        f.id === fineId 
          ? { ...f, status: "PAID", resolvedAt: `${simDate}T${simTime}:00Z`, resolvedByTutorId: "Carlos" } 
          : f
      )
    );

    // 2. Unlock student's account
    setUsers((prevUsers) => 
      prevUsers.map((u) => 
        u.id === matchedFine.studentId 
          ? { ...u, isBlockedByFine: false, fineAmountOwed: 0 } 
          : u
      )
    );

    // Update active session if user is the unlocked one
    if (currentUser && currentUser.id === matchedFine.studentId) {
      setCurrentUser((prev) => prev ? { ...prev, isBlockedByFine: false, fineAmountOwed: 0 } : null);
    }

    addSystemLog(`👮 Multado Desbloqueado: El Tutor cobró $15.00 físicos y desbloqueó el perfil de ${matchedFine.studentName}.`, "SUCCESS");
  };

  const handleToggleMaintenance = (machineId: string) => {
    setMachines((prevM) => 
      prevM.map((m) => {
        if (m.id === machineId) {
          const isCurrentlyOut = m.status === "OUT_OF_SERVICE";
          const newStatus: MachineStatus = isCurrentlyOut ? "AVAILABLE" : "OUT_OF_SERVICE";
          
          addSystemLog(`🔧 Mantenimiento: Tutor cambió la máquina ${machineId} a [${newStatus}].`, isCurrentlyOut ? "SUCCESS" : "WARNING");
          
          return { ...m, status: newStatus };
        }
        return m;
      })
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
      {/* LEFT COLUMN: SIMULATION TIME CONTROLS, SYSTEM STATE & VISUAL TIMELINE */}
      <div className="xl:col-span-8 space-y-6">
        
        {/* CARD 1: RELOJ TEMPORAL DEL EDIFICIO */}
        <div className="bg-slate-950 border border-slate-900 rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">
                Plataforma de Control del Lavadero
              </span>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={18} className="text-emerald-500 animate-pulse" />
                Control de Tiempo de la Residencia
              </h3>
              <p className="text-xs text-slate-400">
                Avanza o atrasa el reloj para probar el vencimiento de turnos, multas automáticas y ciclos de lavado.
              </p>
            </div>

            {/* Simulated Live Clock Display */}
            <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800">
              <div className="text-right">
                <p className="text-[10px] font-mono text-slate-500">Fecha del Simulador</p>
                <p className="text-xs font-semibold text-slate-300">Viernes, Jun 5, 2026</p>
              </div>
              <div className="h-8 w-[1px] bg-slate-800"></div>
              <div>
                <p className="text-[10px] font-mono text-slate-500">Hora Operativa</p>
                <p className="text-xl font-mono text-emerald-400 font-bold tracking-widest">{simTime} hs</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button 
              id="btn-time-1m"
              onClick={() => advanceTimeByMinutes(1)}
              className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 text-slate-300 text-xs py-2.5 px-3 rounded-lg font-medium transition cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>+1 Minuto</span>
            </button>
            <button 
              id="btn-time-15m"
              onClick={() => advanceTimeByMinutes(15)}
              className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 text-slate-300 text-xs py-2.5 px-3 rounded-lg font-medium transition cursor-pointer"
            >
              <RefreshCw size={13} className="text-amber-500 animate-spin-slow" />
              <span>+15 Minutos</span>
            </button>
            <button 
              id="btn-time-36m"
              onClick={() => advanceTimeByMinutes(36)}
              className="flex items-center justify-center gap-2 bg-indigo-950/20 hover:bg-indigo-950/40 border border-indigo-900/50 text-indigo-200 text-xs py-2.5 px-3 rounded-lg font-medium transition cursor-pointer"
            >
              <Play size={13} className="text-indigo-400" />
              <span>+36 Mins (Lavado)</span>
            </button>
            <button 
              id="btn-time-reset"
              onClick={() => {
                setSimTime("13:50");
                setReservations(INITIAL_RESERVATIONS);
                setMachines(INITIAL_MACHINES);
                setUsers(INITIAL_USERS);
                setFines(INITIAL_FINE_LOGS);
                setLogs([
                  {
                    id: "SL_RESET",
                    timestamp: "13:50",
                    type: "SUCCESS",
                    message: "Simulador reiniciado de cero. Hora base fijada a las 13:50 hs."
                  }
                ]);
              }}
              className="flex items-center justify-center gap-2 bg-rose-950/15 hover:bg-rose-950/30 border border-rose-900/25 text-rose-300 text-xs py-2.5 px-3 rounded-lg font-medium transition cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Reiniciar Todo</span>
            </button>
          </div>
        </div>

        {/* TIMELINE ALGORITHMIC VISUALIZER */}
        <AlgorithmVisualizer 
          selectedStartTime={bookingSlot}
          existingReservations={reservations}
          machines={machines}
        />

        {/* LOG SYSTEM VIEWER */}
        <div className="bg-slate-950 border border-slate-900 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Pistas del Servidor / Logs del Sistema
            </h4>
            <span className="text-[10px] font-mono text-slate-500">
              {logs.length} eventos registrados
            </span>
          </div>

          <div className="bg-black/40 border border-slate-900 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-slate-400 space-y-2 select-text">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 border-b border-white/[0.02] pb-1.5 leading-normal">
                <span className="text-slate-500 tracking-wider font-light">[{log.timestamp}]</span>
                <span className={`font-bold shrink-0 ${
                  log.type === "SUCCESS" ? "text-emerald-400" :
                  log.type === "WARNING" ? "text-amber-400" :
                  log.type === "CRITICAL" ? "text-rose-400" : "text-cyan-400"
                }`}>
                  [{log.type}]
                </span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: SIMULATED SMARTPHONE FRAME CONTAINER */}
      <div className="xl:col-span-4 flex justify-center">
        {/* Device frame housing iOS/Android mock look */}
        <div className="w-full max-w-[360px] bg-slate-950 rounded-[40px] border-8 border-slate-800 shadow-2xl overflow-hidden relative flex flex-col min-h-[640px] border-t-[12px] border-b-[12px]">
          
          {/* Top Notch UI */}
          <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 flex items-center justify-between px-6 z-50 text-[9px] font-sans text-slate-400 pointer-events-none pr-7">
            <span>13:50 hs</span>
            <div className="w-16 h-3 bg-slate-950 rounded-full mx-auto -mt-1.5 mb-1 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
            </div>
            <div className="flex items-center gap-1">
              <Wifi size={8} />
              <Battery size={10} className="mt-0.5" />
            </div>
          </div>

          {/* Device Active Role Banner / Fast Login controls */}
          <div className="bg-slate-900 border-b border-slate-800 pt-5 pb-2 px-4 space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono tracking-wider text-indigo-400 font-bold uppercase">
                Rol del Simulador
              </span>
              {currentUser && (
                <button 
                  id="btn-phone-logout"
                  onClick={handleLogout}
                  className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <LogOut size={10} />
                  Salir
                </button>
              )}
            </div>

            {/* Quick account switch selectors for testing UI ease */}
            {!currentUser ? (
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Info size={11} className="text-indigo-400 shrink-0" />
                <span>Inicia sesión abajo para interactuar</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                <div className="truncate">
                  <p className="text-[11px] font-bold text-white leading-none truncate">{currentUser.fullName}</p>
                  <p className="text-[9px] font-mono text-slate-400 mt-1 truncate">{currentUser.email}</p>
                </div>
                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                  currentUser.role === "TUTOR" 
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" 
                    : "bg-cyan-500/15 text-cyan-400 border border-cyan-505/25"
                }`}>
                  {currentUser.role}
                </span>
              </div>
            )}

            {/* Quick selectors row */}
            <div className="grid grid-cols-4 gap-1 pt-1 text-[9px] font-medium font-mono text-slate-400">
              <span className="col-span-1 leading-relaxed text-slate-500 font-bold">Probar:</span>
              <button 
                id="btn-sw-lucia"
                onClick={() => switchStudentAccount("U1")}
                className={`py-0.5 px-1 rounded hover:bg-slate-800 text-center cursor-pointer ${currentUser?.id === "U1" ? "bg-slate-800 text-cyan-400 font-bold" : ""}`}
              >
                Lucía
              </button>
              <button 
                id="btn-sw-paula"
                onClick={() => switchStudentAccount("U3")}
                className={`py-0.5 px-1 rounded hover:bg-slate-800 text-center cursor-pointer ${currentUser?.id === "U3" ? "bg-slate-800 text-rose-400 font-bold" : ""}`}
                title="Sancionada por inasistencia"
              >
                Paula ❌
              </button>
              <button 
                id="btn-sw-tutor"
                onClick={() => switchStudentAccount("U4")}
                className={`py-0.5 px-1 rounded hover:bg-slate-800 text-center cursor-pointer ${currentUser?.id === "U4" ? "bg-slate-800 text-amber-400 font-bold" : ""}`}
              >
                Carlos 👮
              </button>
            </div>
          </div>

          {/* Smartphone screen contents */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-950 flex flex-col justify-between">
            <div>
              {/* Smartphone Global App Header */}
              {currentUser && (
                <div className="flex items-center gap-2 pb-3 mb-2 border-b border-slate-905 border-slate-900">
                  <div className="h-7 w-7 rounded bg-white p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/e/ea/Logo_Universidad_de_San_Andr%C3%A9s.svg"
                      alt="UdeSA Logo"
                      className="h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider font-extrabold text-white leading-none">UdeSA DORMIS</p>
                    <p className="text-[8px] text-indigo-400 font-mono mt-0.5 leading-none font-semibold">Residencia Universitaria</p>
                  </div>
                </div>
              )}

              {/* IF USER NOT LOGGED IN */}
              {!currentUser ? (
                <div className="space-y-4 pt-6 animate-fade-in">
                  <div className="text-center space-y-3">
                    <div className="mx-auto w-16 h-16 rounded-xl bg-white p-2 flex items-center justify-center shadow-lg border border-slate-800">
                      <img 
                        src="https://upload.wikimedia.org/wikipedia/commons/e/ea/Logo_Universidad_de_San_Andr%C3%A9s.svg"
                        alt="Escudo Universidad de San Andrés"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white font-sans tracking-tight uppercase">UDESA DORMIS</h4>
                      <p className="text-[10px] font-mono text-indigo-400 uppercase font-bold tracking-wider mt-0.5">Residencia Universitaria</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-normal">
                        Control de Lavandería Inteligente
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-3 pt-2">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold block mb-1">
                        Email Institucional (@udesa.edu.ar)
                      </label>
                      <input 
                        type="email"
                        id="input-login-email"
                        value={loginEmailInput}
                        onChange={(e) => setLoginEmailInput(e.target.value)}
                        placeholder="tu-cuenta@udesa.edu.ar"
                        className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    {loginError && (
                      <p className="text-[10.5px] text-rose-400 leading-normal bg-rose-950/20 p-2 rounded-lg border border-rose-500/20">
                        {loginError}
                      </p>
                    )}

                    <button 
                      type="submit"
                      id="btn-do-login"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-xs text-white p-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <LogIn size={14} />
                      Iniciar Sesión
                    </button>
                  </form>

                  <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-500 space-y-1.5">
                    <p className="font-bold uppercase text-slate-450 text-slate-400 font-mono">Emails de Prueba (Whitelist):</p>
                    <p>• <span className="text-slate-400 font-semibold text-indigo-350">luciacandelacaceres09@gmail.com</span> (Estudiante)</p>
                    <p>• <span className="text-slate-500">• </span><span className="text-slate-400">blocked.student@un.edu</span> (Estudiante bloqueada)</p>
                    <p>• <span className="text-slate-500">• </span><span className="text-slate-400">tutor.adm@residencia.un.edu</span> (Tutor)</p>
                  </div>
                </div>
              ) : currentUser.role === "STUDENT" ? (
                
                // --- STUDENT MOBILE VIEW ---
                <div className="space-y-4 animate-fade-in">
                  
                  {/* STUDENT NOTICES / FINE BANNER */}
                  {currentUser.isBlockedByFine ? (
                    <div className="bg-rose-950/40 border border-rose-500/20 rounded-xl p-3 space-y-2">
                      <div className="flex items-start gap-2 text-rose-400">
                        <AlertTriangle size={15} className="shrink-0 mt-0.5 animate-bounce" />
                        <div>
                          <p className="text-xs font-bold leading-normal">Servicio Deshabilitado</p>
                          <p className="text-[10.5px] text-slate-300 mt-0.5 leading-normal">Tiene multas acumuladas de <strong>${currentUser.fineAmountOwed.toFixed(2)} USD</strong> por inasistencia (no-show).</p>
                        </div>
                      </div>
                      <p className="text-[9.5px] text-slate-400 leading-normal">
                        Debes presentarte con el Tutor de guardia para abonar la multa en la residencia y desbloquear tu cuenta.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/15 border border-emerald-500/10 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-400">
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Estatus: Activo y Habilitado</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">Límites Semanales consumidos:</p>
                        <div className="grid grid-cols-2 gap-2 mt-1.5 text-[9px] font-mono text-slate-300">
                          <span className="bg-slate-900/60 px-1.5 py-0.5 rounded">Lavar: {currentUser.reservationsCountThisWeek.wash}/2</span>
                          <span className="bg-slate-900/60 px-1.5 py-0.5 rounded">Secar: {currentUser.reservationsCountThisWeek.dry}/2</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* FORM: AGENDAR RESERVA */}
                  {!currentUser.isBlockedByFine && (
                    <div className="bg-slate-900 rounded-2xl p-3.5 border border-slate-800 space-y-3">
                      <h5 className="text-[10.5px] font-mono tracking-wider text-slate-400 uppercase font-bold flex items-center gap-1.5">
                        <Calendar size={13} className="text-indigo-400" />
                        Agendar Turno
                      </h5>

                      <form onSubmit={handleCreateReservation} className="space-y-2.5 text-xs">
                        {/* Selector Hardware maquinas */}
                        <div>
                          <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Elegir Lavadora</label>
                          <select 
                            id="select-laundry-machine"
                            value={selectedMachineId}
                            onChange={(e) => setSelectedMachineId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-medium"
                          >
                            {machines.filter(m => m.type === "WASHER").map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.status === "OUT_OF_SERVICE" ? "— Fuera de Servicio 🔧" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Selector Slot militar */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1">Hora inicio</label>
                            <select 
                              id="select-laundry-slot"
                              value={bookingSlot}
                              onChange={(e) => setBookingSlot(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-mono"
                            >
                              {PRESET_SLOTS.map(slot => (
                                <option key={slot} value={slot}>{slot} hs</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1">Modalidad</label>
                            <select 
                              id="select-laundry-mode"
                              value={bookingType}
                              onChange={(e) => setBookingType(e.target.value as ReservationType)}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-white font-medium"
                            >
                              <option value="SOLO_LAVAR">Solo Lavar</option>
                              <option value="CONJUNTO">Conjunto (Lavar + Secar)</option>
                            </select>
                          </div>
                        </div>

                        {formError && (
                          <p className="text-[10px] text-rose-450 text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-500/20 leading-normal font-sans font-medium">
                            {formError}
                          </p>
                        )}
                        {formSuccess && (
                          <p className="text-[10px] text-emerald-400 bg-emerald-950/20 p-2 rounded border border-emerald-500/20 leading-normal font-sans">
                            {formSuccess}
                          </p>
                        )}

                        <button 
                          type="submit"
                          id="btn-do-reserve"
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-xs text-white p-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={13} />
                          Confirmar Reserva
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ACTIVE RESERVATIONS LIST / WORKFLOWS */}
                  <div className="space-y-2">
                    <h5 className="text-[10.5px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                      Mis Reservas de Hoy
                    </h5>

                    {reservations.filter(r => r.studentId === currentUser.id && r.status !== "CANCELLED").length === 0 ? (
                      <div className="text-center p-6 bg-slate-900/30 rounded-xl border border-slate-900 border-dashed text-xs text-slate-500">
                        No posees reservas vigentes para hoy.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reservations
                          .filter(r => r.studentId === currentUser.id && r.status !== "CANCELLED")
                          .map((res) => {
                            const showStartButton = res.status === "PENDING" || res.status === "READY_TO_START";
                            const showRetrieveButton = res.status === "WAITING_RETRIEVAL" || res.status === "IN_PROGRESS";

                            return (
                              <div key={res.id} className="bg-slate-900 border border-slate-850 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className={`text-[9px] font-semibold font-mono px-1.5 py-0.5 rounded ${
                                    res.status === "PENDING" ? "bg-slate-950 text-slate-400" :
                                    res.status === "READY_TO_START" ? "bg-amber-500/10 text-amber-400" :
                                    res.status === "IN_PROGRESS" ? "bg-cyan-500/15 text-cyan-400 animate-pulse" :
                                    res.status === "WAITING_RETRIEVAL" ? "bg-rose-500/15 text-rose-400 animate-bounce" :
                                    res.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                  }`}>
                                    {res.status}
                                  </span>
                                  <span className="text-[9px] text-slate-500 font-mono">ID: {res.id.split("_")[1]}</span>
                                </div>

                                <div className="text-xs text-slate-300 font-mono space-y-1">
                                  <p>• Máquina: <span className="font-bold text-white">{res.machineId}</span></p>
                                  <p>• Intervalo Lavado: <span className="font-bold text-white">{res.startTime} - {res.endTime} hs</span></p>
                                  {res.secondaryMachineId && (
                                    <p className="text-rose-450 text-pink-400">• Secadora: <span className="font-bold text-pink-300">{res.secondaryMachineId} ({res.secondaryStartTime} - {res.secondaryEndTime} hs)</span></p>
                                  )}
                                </div>

                                {/* QR ACTION CONTROLS */}
                                <div className="flex gap-2 pt-2">
                                  {showStartButton && (
                                    <>
                                      <button 
                                        id={`btn-qr-start-${res.id}`}
                                        onClick={() => openQrScanner(res, "START")}
                                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-[11px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <QrCode size={12} />
                                        Escanear QR
                                      </button>
                                      
                                      <button 
                                        id={`btn-cancel-${res.id}`}
                                        onClick={() => handleCancelReservation(res.id)}
                                        className="text-[10px] text-rose-400 hover:bg-rose-950/20 border border-slate-800 p-1 rounded font-medium cursor-pointer"
                                        title="Cancelar Turno"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  )}

                                  {showRetrieveButton && (
                                    <button 
                                      id={`btn-qr-retrieve-${res.id}`}
                                      onClick={() => openQrScanner(res, "RETRIEVE")}
                                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[11px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <QrCode size={12} />
                                      Escanear QR Retiro
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                
                // --- TUTOR MOBILE VIEW ---
                <div className="space-y-4 animate-fade-in">
                  
                  {/* TUTOR PANEL: COBRO DE MULTAS & DESBLOQUEO */}
                  <div className="space-y-2">
                    <h5 className="text-[10.5px] font-mono tracking-wider text-slate-400 uppercase font-bold flex items-center gap-1.5">
                      <Shield size={13} className="text-amber-500" />
                      Multas Pendientes
                    </h5>

                    {fines.filter(f => f.status === "PENDING").length === 0 ? (
                      <div className="text-center p-6 bg-slate-900/30 rounded-xl border border-slate-900 border-dashed text-xs text-slate-500">
                        No existen multas pendientes de cobro físico.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {fines
                          .filter(f => f.status === "PENDING")
                          .map((fine) => (
                            <div key={fine.id} className="bg-slate-900 border border-slate-850 rounded-xl p-3 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-white truncate max-w-[150px]">{fine.studentName}</span>
                                <span className="text-rose-400 font-mono font-bold">${fine.amount.toFixed(2)} USD</span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-normal">
                                Motivo: <span className="text-amber-500 font-mono font-semibold">{fine.reason === "NO_SHOW" ? "No asistió a su turno" : "Retiro atrasado de máquina"}</span>
                              </p>
                              
                              <button 
                                id={`btn-collect-${fine.id}`}
                                onClick={() => handleCollectFineAndUnlock(fine.id)}
                                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10.5px] font-bold py-1.5 rounded flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <UserCheck size={12} />
                                Desbloquear Perfil
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* TUTOR PANEL: MANTENIMIENTO MÁQUINAS */}
                  <div className="space-y-2">
                    <h5 className="text-[10.5px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                      Mantenimiento de Máquinas
                    </h5>

                    <div className="space-y-2">
                      {machines.map((mach) => (
                        <div key={mach.id} className="bg-slate-950 border border-slate-900 rounded-xl p-2.5 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-white">{mach.name} <span className="text-[9px] font-mono text-slate-500 font-light">[{mach.id}]</span></p>
                            <span className={`text-[10px] font-mono ${
                              mach.status === "AVAILABLE" ? "text-emerald-400" :
                              mach.status === "IN_USE" ? "text-cyan-400" :
                              mach.status === "OUT_OF_SERVICE" ? "text-rose-500" : "text-amber-500"
                            }`}>
                              {mach.status}
                            </span>
                          </div>

                          <button 
                            id={`btn-maint-toggle-${mach.id}`}
                            onClick={() => handleToggleMaintenance(mach.id)}
                            className={`text-[10px] font-bold px-2 py-1 rounded transition cursor-pointer ${
                              mach.status === "OUT_OF_SERVICE" 
                                ? "bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20" 
                                : "bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                            }`}
                          >
                            {mach.status === "OUT_OF_SERVICE" ? "Rehabilitar" : "Inhabilitar"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Simulated Frame Footer */}
            <div className="border-t border-slate-900 pt-3 text-[10px] text-slate-500 text-center select-none font-mono">
              ⚡ Campus Connect v1.3
            </div>
          </div>

          {/* simulated QR scanner Overlay simulation */}
          {activeScanReservation && (
            <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col justify-between p-6 animate-fade-in-rapid">
              <div className="text-center space-y-2 pt-6">
                <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">
                  Enfoque de Cámara Activo
                </p>
                <h4 className="text-base font-bold text-white">Escanear QR de la Máquina</h4>
                <p className="text-xs text-slate-400">{activeScanReservation.machineId} pegado físico</p>
              </div>

              {/* Laser Line Animation box style */}
              <div className="relative w-48 h-48 mx-auto border-2 border-indigo-500 rounded-2xl overflow-hidden flex items-center justify-center bg-black/40">
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-450 border-cyan-400"></div>
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-450 border-cyan-400"></div>
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-450 border-cyan-400"></div>
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-450 border-cyan-400"></div>
                
                {/* Laser animation line */}
                <div className="absolute inset-x-0 h-[2px] bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-scan"></div>
                
                <QrCode size={40} className="text-slate-500/50" />
              </div>

              {/* Cycle selection options only if starting */}
              {scanType === "START" && (
                <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl space-y-2 text-xs">
                  <p className="text-slate-300 font-bold mb-1">Elegir ciclo térmico seleccionado:</p>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono font-medium">
                    {["Caliente", "Tibio", "Frío"].map((c) => (
                      <button
                        key={c}
                        onClick={() => setTempCycleSelected(c as any)}
                        className={`py-1 bg-slate-950 border rounded transition text-center cursor-pointer ${
                          tempCycleSelected === c 
                            ? "border-cyan-450 border-cyan-400 text-cyan-400" 
                            : "border-slate-800 text-slate-500"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal mt-1 italic">
                    * Tibio: 30 minutos. Caliente / Frío: 36 minutos. Inserta ficha tras inicio.
                  </p>
                </div>
              )}

              {/* Trigger mock camera capture success */}
              <div className="space-y-2 pb-6">
                <button 
                  id="btn-scan-action"
                  onClick={handleSimulateQrScanSuccess}
                  className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-350 p-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <QrCode size={14} />
                  Simular QR Escaneado Exitoso
                </button>
                <button 
                  id="btn-scan-cancel"
                  onClick={() => setActiveScanReservation(null)}
                  className="w-full text-xs text-slate-400 hover:text-white p-2 text-center cursor-pointer"
                >
                  Cancelar de Cámara
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
