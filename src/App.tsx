/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import DocTab from "./components/DocTab";
import SimulatorTab from "./components/SimulatorTab";
import { ShieldAlert, BookOpen, Smartphone, Shield, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

export default function App() {
  const [activeRootTab, setActiveRootTab] = useState<"doc" | "sim">("sim");

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 flex flex-col selection:bg-indigo-500/20 selection:text-indigo-900">
      
      {/* GLOBAL HIGH-FIDELITY APP BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo & Architect Name */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/10">
              LR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-sans font-extrabold text-slate-900 uppercase tracking-wider">
                  Campus Laundry Engine
                </h1>
                <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-150">
                  v1.4
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Por: Lucia Candel C. • Senior Fullstack Architect
              </p>
            </div>
          </div>

          {/* Root Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              id="btn-root-sim"
              onClick={() => setActiveRootTab("sim")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeRootTab === "sim"
                  ? "bg-white border border-slate-200 text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Smartphone size={14} className={activeRootTab === "sim" ? "text-indigo-600" : ""} />
              Simulador Interactivo
            </button>
            <button
              id="btn-root-doc"
              onClick={() => setActiveRootTab("doc")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeRootTab === "doc"
                  ? "bg-white border border-slate-200 text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BookOpen size={14} className={activeRootTab === "doc" ? "text-indigo-600" : ""} />
              Especificación Técnica
            </button>
          </div>

        </div>
      </header>

      {/* COMPACT INTRODUCTORY BRIEF BAR */}
      <section className="bg-white border-b border-slate-200 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-slate-650 font-normal leading-normal max-w-4xl text-slate-600">
                <strong>Resumen de Solución:</strong> Para coordinar 3 lavarropas y 2 secarropas en la residencia, propongo un sistema impulsado por un <strong>algoritmo preventivo de redundancia horaria</strong> ejecutado en el backend que desactiva transacciones conflictivas, complementado con <strong>códigos QR de geolocalización</strong> adheridos para auditar la presencia técnica del alumno e inasistencias en lapsos breves.
              </p>
            </div>
            
            {/* Quick stats on specifications satisfied */}
            <div className="flex gap-4 shrink-0 font-mono text-[10px] text-slate-500">
              <div className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span className="text-slate-650 font-semibold">Rango: 07-21 hs</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span className="text-slate-650 font-semibold">Bloqueo Overtime + No-Show</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FRAME LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeRootTab === "sim" ? (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight font-sans">
                  Entorno de Sandbox y Simulación UX
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-normal max-w-2xl">
                  En esta vista puedes personificar a diferentes Estudiantes (complices, bloqueados o habituales) o Tutores. Ajusta la hora operativa en el control de relojería lateral para inspeccionar el motor de sanciones reactivas.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 text-indigo-700 shrink-0 font-bold">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                <span>Motor Reactivo Conectado</span>
              </div>
            </div>

            <SimulatorTab />
          </div>
        ) : (
          <DocTab />
        )}
      </main>

      {/* PLATFORM SECURE FOOTER */}
      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© 2026 Universidad Tecnológica Residencial — Sistema de Lavanderías Autónomas.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="hover:text-slate-850 cursor-help">SLA: 99.98%</span>
            <div className="h-3 w-[1px] bg-slate-200"></div>
            <span className="hover:text-slate-850 cursor-help">RDBMS Relacional</span>
            <div className="h-3 w-[1px] bg-slate-200"></div>
            <span className="text-indigo-600 font-semibold uppercase tracking-wider">Desglose de Ingeniería</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
