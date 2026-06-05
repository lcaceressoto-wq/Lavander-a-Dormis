/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Database, GitFork, Cpu, Smartphone, ShieldCheck, Clock, Key, Layers, RefreshCw, AlertTriangle, Terminal, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface TabProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

const TabButton = ({ label, icon, active, onClick }: TabProps) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-250 cursor-pointer ${
      active
        ? "bg-indigo-600 border border-indigo-750 text-white shadow-xs font-semibold"
        : "text-slate-600 hover:text-slate-950 hover:bg-slate-150 hover:bg-slate-100"
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default function DocTab() {
  const [subTab, setSubTab] = useState<"db" | "algorithm" | "backend" | "ux">("db");
  const [selectedTable, setSelectedTable] = useState<string>("Reservations");

  const tables = {
    Users: {
      desc: "Almacena los datos de estudiantes y tutores. Incluye banderas de bloqueo reputacional por multas impagas y contadores semanales de uso.",
      fields: [
        { name: "id", type: "VARCHAR(50) / PK", desc: "Identificador único de usuario." },
        { name: "email", type: "VARCHAR(120) / UNIQUE INDEX", desc: "Email institucional precargado por administración para el whitelist de login." },
        { name: "full_name", type: "VARCHAR(100)", desc: "Nombre completo del residente." },
        { name: "role", type: "ENUM('STUDENT', 'TUTOR')", desc: "Especifica permisos del usuario." },
        { name: "is_blocked_by_fine", type: "BOOLEAN", desc: "Flag que impide realizar reservaciones si tiene multas físicas impagas." },
        { name: "fine_amount_owed", type: "DECIMAL(10,2)", desc: "Monto total monetario acumulado por multas pendientes de resolución." },
        { name: "reservations_count_wash", type: "INT", desc: "Contador semanal de lavados realizados (Reinicia automáticamente los lunes a las 00:00)." },
        { name: "reservations_count_dry", type: "INT", desc: "Contador semanal de secados realizados (Reinicia automáticamente los lunes a las 00:00)." },
      ],
      indexes: [
        "idx_users_email (Clave única para autenticación)",
        "idx_users_status_fine (Para búsqueda rápida de bloqueados)"
      ],
      triggers: "Antes de insertar reserva: Verificar `is_blocked_by_fine === false` y `reservations_count_wash < 2` (para tipo lavage)."
    },
    Reservations: {
      desc: "Entidad central del sistema. Modela las reservas de lavarropas (e indirectamente secarropas si es paquete Conjunto).",
      fields: [
        { name: "id", type: "VARCHAR(50) / PK", desc: "Identificador único de reserva." },
        { name: "student_id", type: "VARCHAR(50) / FK", desc: "Relacionado con Users(id)." },
        { name: "machine_id", type: "VARCHAR(20) / FK", desc: "Washing machine asignado temporalmente. Relacionado con Machines(id)." },
        { name: "secondary_machine_id", type: "VARCHAR(20) / FK (Nullable)", desc: "Dryer reservado de forma simulada en 'CONJUNTO'. Relacionado con Machines(id)." },
        { name: "type", type: "ENUM('SOLO_LAVAR', 'CONJUNTO')", desc: "Modalidades de reserva de lavandería." },
        { name: "date", type: "DATE / INDEX", desc: "Día calendario de la reserva." },
        { name: "start_time", type: "TIME", desc: "Hora militar de inicio de lavado (ej: '09:00')." },
        { name: "end_time", type: "TIME", desc: "Hora militar de fin de lavado (ej: '10:15')." },
        { name: "secondary_start_time", type: "TIME (Nullable)", desc: "Hora proyectada para el inicio del secado (ej: '09:45')." },
        { name: "secondary_end_time", type: "TIME (Nullable)", desc: "Hora proyectada para terminar secado total (ej: '10:30')." },
        { name: "status", type: "ENUM", desc: "PENDING, READY_TO_START, IN_PROGRESS, WAITING_RETRIEVAL, COMPLETED, EXPIRED_NOSHOW, CANCELLED." },
        { name: "qr_scanned_to_start", type: "BOOLEAN", desc: "Flag que certifica presencia física al inicio del turno." },
        { name: "qr_scanned_to_retrieve", type: "BOOLEAN", desc: "Flag que certifica el correcto retiro de la ropa para liberar la máquina." },
        { name: "created_at", type: "TIMESTAMP", desc: "Auditoría de alta del registro." }
      ],
      indexes: [
        "idx_reservations_check_overlap (date, machine_id, start_time, end_time)",
        "idx_reservations_weekly_limit (student_id, date)",
        "idx_reservations_status (status)"
      ],
      triggers: "Tras cancelación automática por inasistencia (No-Show): Cambiar status a `EXPIRED_NOSHOW`, marcar máquina como `AVAILABLE`, crear boleto en `FineLogs` y cambiar `Users.is_blocked_by_fine = true`."
    },
    Machines: {
      desc: "Hardware del edificio. Representa los 3 lavarropas físicos (L1, L2, L3) y los 2 secarropas (S1, S2).",
      fields: [
        { name: "id", type: "VARCHAR(20) / PK", desc: "Identificador único de máquina (ej: 'L1', 'S2')." },
        { name: "name", type: "VARCHAR(50)", desc: "Etiqueta para el usuario (ej: 'Lavarropas Superior Pro')." },
        { name: "type", type: "ENUM('WASHER', 'DRYER')", desc: "Función específica del hardware." },
        { name: "status", type: "ENUM", desc: "AVAILABLE, IN_USE, RESERVED, OUT_OF_SERVICE, RETRIEVAL_PENDING." },
        { name: "current_user_id", type: "VARCHAR(50) / FK (Nullable)", desc: "ID del estudiante operando la máquina en este instante." },
        { name: "current_reservation_id", type: "VARCHAR(50) / FK (Nullable)", desc: "ID de la reserva que disparó el uso actual." }
      ],
      indexes: [
        "idx_machines_type_status (type, status)"
      ],
      triggers: "Cuando el sistema cambia a OUT_OF_SERVICE: Se cancelan automáticamente las reservas futuras huérfanas vinculadas exclusivamente a esta máquina en las próximas 24 horas y se notifica al estudiante."
    },
    FineLogs: {
      desc: "Libro diario de multas generadas. Los tutores consultan esta tabla para auditar deudas y habilitar alumnos manualmente.",
      fields: [
        { name: "id", type: "VARCHAR(50) / PK", desc: "ID serial del cobro." },
        { name: "student_id", type: "VARCHAR(50) / FK", desc: "Estudiante penalizado. Relacionado con Users(id)." },
        { name: "reservation_id", type: "VARCHAR(50) / FK", desc: "Turno que gatilló la multa. Relacionado con Reservations(id)." },
        { name: "reason", type: "ENUM('NO_SHOW', 'RETRIEVAL_OVERTIME')", desc: "Indica si no asistió o si dejó la ropa olvidada bloqueando a otros." },
        { name: "amount", type: "DECIMAL(10,2)", desc: "Costo fijo monetario estipulado para la penalización (ej: $15.00)." },
        { name: "created_at", type: "TIMESTAMP", desc: "Instante exacto de la penalización." },
        { name: "resolved_at", type: "TIMESTAMP (Nullable)", desc: "Fecha de pago y destrabe." },
        { name: "resolved_by_tutor_id", type: "VARCHAR(50) / FK (Nullable)", desc: "Tutor que cobró físicamente y auditó el dinero." },
        { name: "status", type: "ENUM('PENDING', 'PAID')", desc: "Estado actual de la multa." }
      ],
      indexes: [
        "idx_fines_student (student_id, status)"
      ],
      triggers: "Tras actualización a PAID: Si el estudiante no posee ninguna otra multa en PENDING, se actualiza automáticamente `Users.is_blocked_by_fine = false` y `Users.fine_amount_owed = 0`."
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Encabezado General */}
      <div>
        <h1 className="text-3xl font-sans font-black tracking-tight text-slate-900 mb-2" id="dt-title">
          Arquitectura, Base de Datos y Lógica del Sistema
        </h1>
        <p className="text-slate-500 max-w-3xl text-sm leading-relaxed" id="dt-desc">
          Especificación de ingeniería detallada para el sistema de lavandería inteligente. Diseñado con esquemas relacionales robustos, control continuo de simultaneidad concurrente y flujos libres de bloqueos.
        </p>
      </div>

      {/* Botones de Navegación Secundaria */}
      <div className="flex flex-wrap gap-2.5 pb-2 border-b border-slate-200">
        <TabButton
          id="tab-db"
          label="Modelo de Base de Datos"
          icon={<Database size={16} />}
          active={subTab === "db"}
          onClick={() => setSubTab("db")}
        />
        <TabButton
          id="tab-algo"
          label="Algoritmo de Simultaneidad"
          icon={<GitFork size={16} />}
          active={subTab === "algorithm"}
          onClick={() => setSubTab("algorithm")}
        />
        <TabButton
          id="tab-backend"
          label="Lógica Backend y Cron Jobs"
          icon={<Cpu size={16} />}
          active={subTab === "backend"}
          onClick={() => setSubTab("backend")}
        />
        <TabButton
          id="tab-ux"
          label="Flujo de Pantallas (UX)"
          icon={<Smartphone size={16} />}
          active={subTab === "ux"}
          onClick={() => setSubTab("ux")}
        />
      </div>

      {/* Contenido según Selección */}
      <div className="min-h-[450px]">
        {subTab === "db" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Relational Entity Diagrams / Selector */}
            <div className="lg:col-span-4 space-y-3">
              <h3 className="text-xs font-mono tracking-wider text-slate-500 uppercase font-semibold">
                Tablas & Entidades SQL
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Selecciona una tabla para explorar sus campos, índices, llaves y disparadores.
              </p>
              <div className="space-y-2">
                {Object.keys(tables).map((tableName) => (
                  <button
                    key={tableName}
                    id={`btn-table-${tableName}`}
                    onClick={() => setSelectedTable(tableName)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all text-sm font-medium flex items-center justify-between cursor-pointer ${
                      selectedTable === tableName
                        ? "bg-indigo-600 border-indigo-650 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-md ${selectedTable === tableName ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                        <Layers size={14} />
                      </div>
                      <span>{tableName}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${selectedTable === tableName ? "bg-indigo-750 text-indigo-100" : "bg-slate-100 text-slate-500"}`}>
                      {tables[tableName as keyof typeof tables].fields.length} campos
                    </span>
                  </button>
                ))}
              </div>

              {/* Entity Relation Blueprint Mini card */}
              <div className="bg-white border border-slate-200 shadow-xs rounded-xl p-4 mt-6">
                <span className="text-[10px] font-mono tracking-wider text-indigo-600 uppercase font-semibold block mb-2">
                  Relaciones Integradas
                </span>
                <div className="text-[11px] font-mono text-slate-650 space-y-1.5 leading-relaxed text-slate-655">
                  <div className="flex items-center gap-1.5">
                    <span className="text-indigo-600 font-semibold">Users.id</span> (1) ── (N) <span className="text-indigo-600 font-semibold">Reservations.student_id</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-700 font-semibold">Machines.id</span> (1) ── (N) <span className="text-emerald-700 font-semibold">Reservations.machine_id</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-700 font-semibold">Reservations.id</span> (1) ── (1) <span className="text-amber-700 font-semibold">FineLogs.reservation_id</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Database Table details */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-sans font-extrabold text-slate-900">
                    {selectedTable}
                  </h2>
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-mono px-2 py-0.5 rounded border border-indigo-150 font-semibold animate-none">
                    Entidad RDBMS
                  </span>
                </div>
                <p className="text-sm text-slate-550 leading-relaxed text-slate-500">
                  {tables[selectedTable as keyof typeof tables].desc}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-mono tracking-wider text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Campo</th>
                      <th className="py-2.5 px-3">Tipo de Dato / Atributo</th>
                      <th className="py-2.5 px-3">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-xs text-slate-705 text-slate-700">
                    {tables[selectedTable as keyof typeof tables].fields.map((field, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono text-indigo-650 font-extrabold text-indigo-700">
                          {field.name}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                          {field.type}
                        </td>
                        <td className="py-3 px-3 text-slate-500 leading-normal">
                          {field.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-150">
                  <span className="text-[10px] font-mono text-amber-700 font-bold uppercase tracking-wider block mb-2">
                    Índices de Base de Datos
                  </span>
                  <ul className="text-xs font-mono text-slate-600 space-y-1.5 list-disc pl-4.5">
                    {tables[selectedTable as keyof typeof tables].indexes.map((idx, index) => (
                      <li key={index}>{idx}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-150">
                  <span className="text-[10px] font-mono text-indigo-700 font-bold uppercase tracking-wider block mb-2">
                    Triggers & Reglas Automáticas
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    {tables[selectedTable as keyof typeof tables].triggers}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === "algorithm" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                  <GitFork size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Algoritmo de Colisión y Simultaneidad de Secado</h3>
                  <p className="text-xs text-slate-500">Asegura la reserva óptima del paquete dual &quot;Conjunto&quot; sin sobrepasar el límite físico de 2 secarropas.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Text Explanation */}
                <div className="lg:col-span-5 space-y-4 text-xs text-slate-700 leading-relaxed">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-sans font-bold text-slate-800">¿Por qué es necesario?</h4>
                    <p>
                      El edificio posee <strong>3 lavarropas</strong> pero únicamente <strong>2 secarropas</strong>. Si los tres lavarropas se reservan en el mismo bloque para iniciar un lavado y los tres eligen la opción &quot;Conjunto&quot;, habrá un <strong>bloqueo competitivo irresoluble</strong> en el bloque continuo. 
                    </p>
                    <p>
                      El tercer estudiante no encontrará secadoras disponibles físicamente y el sistema habrá colisionado.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-sans font-bold text-slate-800">Secuencia de Solución Matemática:</h4>
                    <ul className="list-decimal pl-4.5 space-y-2 font-sans">
                      <li>
                        Estudiante solicita iniciar su Lavado el día <strong>D</strong> a la hora <strong>H_lavado</strong>.
                      </li>
                      <li>
                        El sistema calcula el término del ciclo de lavado (máximo 36 minutos) y suma 9 minutos de traslado físico: <br/>
                        <code className="text-[10px] font-mono text-cyan-705 bg-slate-900 px-1.5 text-indigo-350 rounded block mt-1 py-1 text-slate-200">H_secado_solicitada = H_lavado + 45 minutos</code>
                      </li>
                      <li>
                        El ciclo de secado tiene un bloqueo garantizado de 45 minutos:<br/>
                        <code className="text-[10px] font-mono text-cyan-705 bg-slate-900 px-1.5 text-indigo-350 rounded block mt-1 py-1 text-slate-200">Rango_Secador = [H_secado_solicitada, H_secado_solicitada + 45m]</code>
                      </li>
                      <li>
                        El backend filtra todas las reservas activas que ya usan secador en esa misma fecha <strong>D</strong>.
                      </li>
                      <li>
                        Para cada reserva previa, calcula si sus rangos de secado se traslapan con el rango solicitado.
                      </li>
                      <li>
                        Si las reservas traslapadas activas son <span className="text-amber-700 font-bold">&gt;= 2 (cantidad de secadoras físicas activas)</span>, el sistema <strong>rechaza la modalidad Conjunto</strong> y fuerza al tercer lavarropas a operar únicamente en la variante <strong>&quot;Solo Lavar&quot;</strong>.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Code Window / Implementation Representation */}
                <div className="lg:col-span-7 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-md">
                  <div className="bg-slate-850 px-4 py-2.5 border-b border-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal size={14} className="text-indigo-400" />
                      <span className="text-[11px] font-mono text-slate-300 font-semibold">algorithm.ts</span>
                    </div>
                    <span className="text-[10px] text-emerald-450 bg-emerald-950/40 px-2 py-0.5 rounded font-mono text-emerald-300 border border-emerald-900">
                      Production Ready
                    </span>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[380px] font-mono text-[10.5px] leading-relaxed text-slate-400 bg-slate-950">
                    <pre className="text-emerald-300">
{`export function validateConjuntoAvailability(
  selectedStartTime: string,
  date: string,
  existingReservations: Reservation[],
  machines: Machine[]
): SimultaneityValidationResult {
  const startMins = timeToMinutes(selectedStartTime);
  
  // 1. Restricción Operativa Horaria General (07:00 a 21:00)
  if (startMins < timeToMinutes("07:00") || startMins > timeToMinutes("21:00")) {
    return { isConjuntoAllowed: false, reason: "Fuera de horario operativo." };
  }

  // 2. Restricción de Cierre de Lavado Conjunto (Último inicio: 19:45 hs)
  if (startMins > timeToMinutes("19:45")) {
    return { isConjuntoAllowed: false, reason: "Último turno lavado Conjunto es a las 19:45 hs." };
  }

  // 3. Rango de Bloqueo del Secador Proyectado
  const dryStartMins = startMins + 45; // 36m de lavado + 9m gracia de traslado
  const dryEndMins = dryStartMins + 45; // Ciclo secado estándar de 45 minutos

  // 4. Contar secadoras físicas ACTIVAS (no estén Fuera de Servicio)
  const activeDryers = machines.filter(m => m.type === "DRYER" && m.status !== "OUT_OF_SERVICE");
  const totalActiveDryers = activeDryers.length;

  // 5. Filtrar intersecciones temporales de otras reservas activas
  const conflictingReservations = existingReservations.filter(res => {
    if (res.date !== date || res.status === "CANCELLED" || res.status === "EXPIRED_NOSHOW") return false;
    if (res.type !== "CONJUNTO" || !res.secondaryStartTime || !res.secondaryEndTime) return false;

    const prevDryStart = timeToMinutes(res.secondaryStartTime);
    const prevDryEnd = timeToMinutes(res.secondaryEndTime);

    // Traslape matemático de intervalos [A, B] y [C, D]: A < D y C < B
    return dryStartMins < prevDryEnd && prevDryStart < dryEndMins;
  });

  // 6. Si el traslape iguala o supera las secadoras físicas disponibles, bloqueamos
  if (conflictingReservations.length >= totalActiveDryers) {
    return {
      isConjuntoAllowed: false,
      reason: "Conflicto de Simultaneidad: No hay secadoras libres para el bloque complementario posterior."
    };
  }

  // 7. Retornar éxito con asignación preventiva del ID
  const allDryerIds = activeDryers.map(d => d.id);
  const occupiedDryers = new Set(conflictingReservations.map(r => r.secondaryMachineId));
  const freeDryerId = allDryerIds.find(id => !occupiedDryers.has(id)) || allDryerIds[0];

  return { isConjuntoAllowed: true, assignedDryerId: freeDryerId };
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === "backend" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-55/15 bg-emerald-50 text-emerald-700">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Lógica del Backend y Engine de Expiración</h3>
                  <p className="text-xs text-slate-500">Rutinas desatendidas (Cron-jobs, Serverless Functions) que resguardan la rotatividad y aplican penalizaciones.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <span className="text-[10px] font-mono text-indigo-700 uppercase tracking-wider font-extrabold block">
                    Rutina 1: Liberación Automática y Multa por Inasistencia (No-Show)
                  </span>
                  <div className="space-y-2.5 text-xs text-slate-700">
                    <p className="font-bold text-slate-800">Frecuencia de ejecución: Cada 5 minutos.</p>
                    <p className="leading-relaxed text-slate-650 text-slate-500">
                      Un programador de tareas (como Cloud Scheduler que gatilla una Cloud Function HTTP o un cron de node-cron) analiza constantemente las reservas en estado <code className="bg-slate-900 font-mono px-1.5 py-0.5 text-slate-200 border border-slate-800 text-[10px] rounded">PENDING</code>.
                    </p>
                    <div className="border-l-2 border-indigo-500 pl-3 py-1 bg-indigo-50 text-slate-700 leading-normal">
                      <strong>Filtro de Expulsión:</strong> Si el tiempo actual del servidor supera la hora de inicio de una reserva por más de <strong>15 minutos</strong> (<code className="bg-slate-900 font-mono text-indigo-300 text-[11px] px-1 rounded">currentTime &gt; startTime + 15m</code>) y el flag <code className="bg-slate-900 font-mono text-[10.5px] px-1 text-slate-300 rounded">qr_scanned_to_start</code> sigue siendo FALSO:
                    </div>
                    <ul className="list-disc pl-5 text-slate-500 space-y-1.5 leading-relaxed">
                      <li>El backend actualiza la reserva a <code className="text-red-700 font-mono font-semibold">EXPIRED_NOSHOW</code>.</li>
                      <li>Libera inmediatamente la máquina física asignada (<code className="text-emerald-700 font-mono">status = 'AVAILABLE'</code>), poniéndola al servicio de los demás.</li>
                      <li>Cambia el registro del estudiante a <code className="text-red-700 font-mono font-bold">is_blocked_by_fine = true</code> e incrementa <code className="font-mono text-slate-800 font-semibold">fine_amount_owed += 15.00</code>.</li>
                      <li>Inserta un boleto en <code className="font-mono text-slate-705">FineLogs</code> detallando la fecha y la inasistencia.</li>
                      <li>Despacha una notificación push informando al alumno del bloqueo y de la sanción.</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <span className="text-[10px] font-mono text-amber-700 uppercase tracking-wider font-extrabold block">
                    Rutina 2: Limpieza de Máquina Ocupada por Olvido (Overtime)
                  </span>
                  <div className="space-y-2.5 text-xs text-slate-700">
                    <p className="font-bold text-slate-800">Frecuencia de ejecución: Escucha continua al terminar ciclo.</p>
                    <p className="leading-relaxed text-slate-500 text-slate-500">
                      Controla lo que sucede una vez transcurrido el tiempo determinado del ciclo de lavado / secado seleccionado (36 o 30 minutos).
                    </p>
                    <div className="border-l-2 border-amber-500 pl-3 py-1 bg-amber-50 text-slate-700 leading-normal">
                      <strong>Lógica del Margen Retiro (5 min):</strong> El alumno recibe alertas automáticas que informan que el ciclo culminó. Posee 5 minutos cronometrados para acercarse al hardware de lavado, retirar sus prendas y escanear por segunda vez el código QR que certifica el retiro.
                    </div>
                    <p className="text-slate-550 text-slate-500 leading-normal">
                      <strong>Si NO completa la confirmación física de retiro en +5 minutos:</strong>
                    </p>
                    <ul className="list-disc pl-5 text-slate-500 space-y-1.5 leading-relaxed font-light">
                      <li>El backend cataloga la reserva como liberada de máquina para no tapar el servicio de los demás (la máquina se muestra en la app como <code className="text-emerald-700 font-mono">AVAILABLE</code> para el siguiente turno).</li>
                      <li>La máquina se marca internamente en estado <code className="text-amber-800 font-mono">RETRIEVAL_PENDING</code> de forma temporal para que el tutor visualice que hay ropa abandonada.</li>
                      <li>Se emite una <strong>alerta automática al canal de notificaciones push de los Tutores de guardia</strong> para que procedan a retirar la ropa (colocándola en un canasto comunitario del edificio) y multen físicamente al infractor.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Serverless Implementation Sample code */}
              <div className="mt-6 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden text-xs">
                <div className="bg-slate-850 px-4 py-2.5 flex items-center justify-between border-b border-slate-950">
                  <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-yellow-400" />
                    <span className="text-[11px] font-mono text-slate-300 font-semibold">cloud_functions/check_noshow.ts</span>
                  </div>
                </div>
                <div className="p-4 font-mono text-[10.5px] text-slate-400 bg-slate-950 select-text overflow-x-auto whitespace-pre leading-relaxed">
{`import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Corre cada 5 minutos aplicando las reglas de multas
export const checkNoShowsScheduler = functions.pubsub
  .schedule('*/5 * * * *')
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const currentDateStr = now.toDate().toISOString().split('T')[0];
    const currentMins = now.toDate().getHours() * 60 + now.toDate().getMinutes();

    // Obtener reservas pendientes de hoy
    const pendingSnap = await db.collection('reservations')
      .where('date', '==', currentDateStr)
      .where('status', '==', 'PENDING')
      .get();

    const batch = db.batch();

    pendingSnap.forEach(doc => {
      const res = doc.data();
      const startMins = parseTimeToMinutes(res.startTime);
      const graceLimitMins = startMins + 15; // 15 minutos de gracia

      // Si el estudiante no vino y pasaron los 15 minutos:
      if (currentMins > graceLimitMins) {
        // 1. Cancelar reserva
        batch.update(doc.ref, { status: 'EXPIRED_NOSHOW' });

        // 2. Liberar máquina física para otros usuarios
        batch.update(db.collection('machines').doc(res.machineId), {
          status: 'AVAILABLE',
          currentUserId: null,
          currentReservationId: null
        });

        // 3. Bloquear estudiante y generarle una multa
        const userRef = db.collection('users').doc(res.studentId);
        batch.update(userRef, {
          isBlockedByFine: true,
          fineAmountOwed: admin.firestore.FieldValue.increment(15.00)
        });

        // 4. Registrar boleto de multa para auditoría de tutores
        const fineRef = db.collection('fine_logs').doc();
        batch.set(fineRef, {
          id: fineRef.id,
          studentId: res.studentId,
          studentName: res.studentName,
          reservationId: doc.id,
          reason: 'NO_SHOW',
          amount: 15.00,
          createdAt: now,
          status: 'PENDING'
        });

        // 5. Enviar Notificación Push obligatoria
        sendPushNotification(res.studentId, {
          title: "Sanción aplicada - No Show",
          body: "No registraste la asistencia a tu turno de lavado en los 15 minutos de gracia. Tu servicio fue cancelado, y has sido bloqueado. Acude con un Tutor para abonar la multa físicamente."
        });
      }
    });

    await batch.commit();
    console.log("Scheduler de cancelaciones por inasistencia ejecutado exitosamente.");
  });`}
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === "ux" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <Smartphone size={18} className="text-indigo-600" />
                Flujo de Navegación y Pantallas Claves del Dispositivo Móvil
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Estudiante visual flow */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Flujo del Estudiante (Residentes)</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="relative pl-6 border-l border-slate-200 space-y-4 text-xs text-slate-700">
                      {/* Step 1 */}
                      <div className="relative">
                        <span className="absolute -left-[30px] top-0 w-4.5 h-4.5 bg-white border border-slate-200 rounded-full flex items-center justify-center font-mono text-[9px] text-cyan-600 font-bold shadow-2xs">1</span>
                        <h5 className="font-bold text-slate-800">Login e Identificación Inicial</h5>
                        <p className="text-slate-500 mt-1">El alumno ingresa únicamente con el correo escolar registrado por administración. Si es rechazado, se le instruye personarse en administración.</p>
                      </div>

                      {/* Step 2 */}
                      <div className="relative">
                        <span className="absolute -left-[30px] top-0 w-4.5 h-4.5 bg-white border border-slate-200 rounded-full flex items-center justify-center font-mono text-[9px] text-cyan-600 font-bold shadow-2xs">2</span>
                        <h5 className="font-bold text-slate-800">Dashboard con Indicadores de Límite</h5>
                        <p className="text-slate-500 mt-1">Visualiza de inmediato cuántas reservas le restan para la semana actual (Límite: 2 de lavado y 2 de secado) y si su estatus está bloqueado por el pago físico de multas.</p>
                      </div>

                      {/* Step 3 */}
                      <div className="relative">
                        <span className="absolute -left-[30px] top-0 w-4.5 h-4.5 bg-white border border-slate-200 rounded-full flex items-center justify-center font-mono text-[9px] text-cyan-600 font-bold shadow-2xs">3</span>
                        <h5 className="font-bold text-slate-800">Agendamiento de Reserva & Regla de Simultaneidad</h5>
                        <p className="text-slate-500 mt-1">Selecciona fecha y hora militar de inicio. Al elegir &quot;Conjunto&quot;, el sistema de forma veloz audita si habrá un secador libre tras terminar (45 min después). Si se inscribe una coincidencia extrema, se bloquea el check dual detallando el motivo.</p>
                      </div>

                      {/* Step 4 */}
                      <div className="relative">
                        <span className="absolute -left-[30px] top-0 w-4.5 h-4.5 bg-white border border-slate-200 rounded-full flex items-center justify-center font-mono text-[9px] text-cyan-600 font-bold shadow-2xs">4</span>
                        <h5 className="font-bold text-slate-800">Apertura del Turno por Código QR</h5>
                        <p className="text-slate-500 mt-1">Al personarse en el lavadero, ingresa su ficha física, presiona el botón y enfoca con la cámara de la App el código QR pegado a la máquina. Ello habilita habilitar el ciclo: caliente (36 min), tibio (30 min) o frío (36 min).</p>
                      </div>

                      {/* Step 5 */}
                      <div className="relative">
                        <span className="absolute -left-[30px] top-0 w-4.5 h-4.5 bg-white border border-slate-200 rounded-full flex items-center justify-center font-mono text-[9px] text-cyan-600 font-bold shadow-2xs">5</span>
                        <h5 className="font-bold text-slate-800">Seguimiento en Vivo del Ciclo y Retiro</h5>
                        <p className="text-slate-500 mt-1">Se abre la pantalla del cronómetro con alertas push programadas a los 15, 10 y 5 minutos. Concluido el ciclo, tiene 5 minutos para escanear de nuevo el QR que formaliza el retiro y mantener su estatus limpio.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tutor visual flow */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Flujo del Tutor (Administradores)</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="relative pl-6 border-l border-slate-200 space-y-4 text-xs text-slate-700">
                      {/* Step 1 */}
                      <div className="relative">
                        <span className="absolute -left-[30px] top-0 w-4.5 h-4.5 bg-white border border-slate-200 rounded-full flex items-center justify-center font-mono text-[9px] text-amber-600 font-bold shadow-2xs">1</span>
                        <h5 className="font-bold text-slate-800">Panel Especial de Alertas</h5>
                        <p className="text-slate-500 mt-1">El tutor de guardia tiene acceso a una vista centralizada donde recibe inmediato aviso de qué estudiantes han dejado ropa olvidada y superaron los 5 min de gracia tras finalizar el turno.</p>
                      </div>

                      {/* Step 2 */}
                      <div className="relative">
                        <span className="absolute -left-[30px] top-0 w-4.5 h-4.5 bg-white border border-slate-200 rounded-full flex items-center justify-center font-mono text-[9px] text-amber-600 font-bold shadow-2xs">2</span>
                        <h5 className="font-bold text-slate-800">Mantenimiento de Máquinas Clínicas</h5>
                        <p className="text-slate-500 mt-1">El tutor puede inhabilitar de forma manual y urgente cualquier lavarropas o secadora que exhiba roturas o fallas de agua. Esto actualiza en tiempo real la lógica de disponibilidad del sistema.</p>
                      </div>

                      {/* Step 3 */}
                      <div className="relative">
                        <span className="absolute -left-[30px] top-0 w-4.5 h-4.5 bg-white border border-slate-200 rounded-full flex items-center justify-center font-mono text-[9px] text-amber-600 font-bold shadow-2xs">3</span>
                        <h5 className="font-bold text-slate-800">Cobro de Multas y Desbloqueo de Estudiantes</h5>
                        <p className="text-slate-500 mt-1">El tutor recibe el abono físico de la multa de $15.00 en metálico de parte del alumno bloqueado por inasistencia (no-show) u olvido. Luego de recibir el dinero, busca al alumno en la interfaz, presiona el botón de desbloqueo, lo que restablece su reputación en el backend de forma inmediata.</p>
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-150 flex gap-2">
                      <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-indigo-950 leading-normal font-sans font-medium">
                        <strong>Control Administrativo Sólido:</strong> Este esquema híbrido complementa la cerradura del edificio y la disponibilidad técnica de la app con el liderazgo de los alumnos avanzados, resolviendo conflictos de convivencia con facilidad.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
