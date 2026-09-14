'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Tu import de Firebase

interface Pregunta {
  id: string;
  numero: number;
  pregunta: string;
  respuesta: string;
  area: string;
  estado: string;
  creado?: any;
}

export default function AdminFAQ() {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filtroArea, setFiltroArea] = useState('');
  const [busqueda, setBusqueda] = useState('');
  
  // Formulario
  const [modo, setModo] = useState<'list' | 'nuevo' | 'editar'>('list');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    numero: 0,
    pregunta: '',
    respuesta: '',
    area: ''
  });

  // Cargar preguntas en tiempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'preguntas-frecuentes'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Pregunta));
        
        // Ordenar por número
        data.sort((a, b) => a.numero - b.numero);
        setPreguntas(data);
        
        // Extraer áreas únicas
        const areasUnicas = [...new Set(data.map(p => p.area))].sort();
        setAreas(areasUnicas as string[]);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, []);

  // Filtrar preguntas
  const preguntasFiltradas = preguntas.filter(p => {
    const matchArea = !filtroArea || p.area === filtroArea;
    const matchBusqueda = 
      p.pregunta.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.respuesta.toLowerCase().includes(busqueda.toLowerCase());
    return matchArea && matchBusqueda;
  });

  // Guardar nueva pregunta
  const handleGuardarNueva = async () => {
    if (!formData.pregunta.trim() || !formData.respuesta.trim() || !formData.area.trim()) {
      alert('Completa todos los campos');
      return;
    }

    try {
      const nuevoNumero = Math.max(...preguntas.map(p => p.numero), 0) + 1;
      
      await addDoc(collection(db, 'preguntas-frecuentes'), {
        numero: nuevoNumero,
        pregunta: formData.pregunta.trim(),
        respuesta: formData.respuesta.trim(),
        area: formData.area.trim(),
        estado: 'REVISADA',
        creado: new Date()
      });

      // Reset
      setFormData({ numero: 0, pregunta: '', respuesta: '', area: '' });
      setModo('list');
      alert('✓ Pregunta agregada');
    } catch (error) {
      alert('Error al guardar: ' + error);
    }
  };

  // Actualizar pregunta
  const handleGuardarEdicion = async () => {
    if (!formData.pregunta.trim() || !formData.respuesta.trim() || !formData.area.trim()) {
      alert('Completa todos los campos');
      return;
    }

    try {
      await updateDoc(doc(db, 'preguntas-frecuentes', editandoId!), {
        pregunta: formData.pregunta.trim(),
        respuesta: formData.respuesta.trim(),
        area: formData.area.trim()
      });

      setModo('list');
      setEditandoId(null);
      setFormData({ numero: 0, pregunta: '', respuesta: '', area: '' });
      alert('✓ Pregunta actualizada');
    } catch (error) {
      alert('Error al actualizar: ' + error);
    }
  };

  // Borrar pregunta
  const handleBorrar = async (id: string, pregunta: string) => {
    if (confirm(`¿Borrar: "${pregunta}"?`)) {
      try {
        await deleteDoc(doc(db, 'preguntas-frecuentes', id));
        alert('✓ Pregunta borrada');
      } catch (error) {
        alert('Error al borrar: ' + error);
      }
    }
  };

  // Editar pregunta
  const handleEditar = (p: Pregunta) => {
    setFormData({
      numero: p.numero,
      pregunta: p.pregunta,
      respuesta: p.respuesta,
      area: p.area
    });
    setEditandoId(p.id);
    setModo('editar');
  };

  // Importar CSV
  const handleImportarCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target?.result as string;
        const lineas = csv.split('\n').filter(l => l.trim());
        
        // Saltar encabezado
        const datos = lineas.slice(1);
        let agregadas = 0;

        for (const linea of datos) {
          const [numero, pregunta, respuesta, area] = linea.split('|').map(s => s.trim());
          
          if (pregunta && respuesta && area) {
            await addDoc(collection(db, 'preguntas-frecuentes'), {
              numero: parseInt(numero) || Math.max(...preguntas.map(p => p.numero), 0) + 1,
              pregunta,
              respuesta,
              area,
              estado: 'REVISADA',
              creado: new Date()
            });
            agregadas++;
          }
        }

        alert(`✓ ${agregadas} preguntas importadas`);
        (e.target as HTMLInputElement).value = '';
      } catch (error) {
        alert('Error en importación: ' + error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>📋 Panel Admin - Preguntas FAQ ISSP</h1>
        <p style={{ color: '#666', marginTop: 0 }}>Total: {preguntas.length} preguntas · {preguntasFiltradas.length} mostradas</p>
      </div>

      {/* MODO: LISTA */}
      {modo === 'list' && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => {
                setModo('nuevo');
                setFormData({ numero: 0, pregunta: '', respuesta: '', area: '' });
              }}
              style={{
                padding: '10px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              + Nueva pregunta
            </button>

            <input
              type="text"
              placeholder="Buscar pregunta o respuesta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                flex: 1,
                minWidth: '200px'
              }}
            />

            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              style={{
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                minWidth: '180px'
              }}
            >
              <option value="">Todas las áreas ({preguntas.length})</option>
              {areas.map(area => {
                const count = preguntas.filter(p => p.area === area).length;
                return (
                  <option key={area} value={area}>{area} ({count})</option>
                );
              })}
            </select>

            <label style={{
              padding: '10px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}>
              📥 Importar CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleImportarCSV}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Tabla */}
          {loading ? (
            <p style={{ textAlign: 'center', color: '#999' }}>Cargando preguntas...</p>
          ) : preguntasFiltradas.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No hay preguntas</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: 'white'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', width: '60px' }}>N°</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Pregunta</th>
                    <th style={{ padding: '12px', textAlign: 'left', width: '150px' }}>Área</th>
                    <th style={{ padding: '12px', textAlign: 'center', width: '120px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {preguntasFiltradas.map((p, idx) => (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb'
                      }}
                    >
                      <td style={{ padding: '12px', fontWeight: 'bold', color: '#3b82f6' }}>{p.numero}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>{p.pregunta}</div>
                        <div style={{ fontSize: '12px', color: '#666', maxHeight: '40px', overflow: 'hidden' }}>
                          {p.respuesta.substring(0, 100)}...
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {p.area}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleEditar(p)}
                          style={{
                            marginRight: '8px',
                            padding: '6px 10px',
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✏ Editar
                        </button>
                        <button
                          onClick={() => handleBorrar(p.id, p.pregunta)}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✗ Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* MODO: NUEVA PREGUNTA */}
      {modo === 'nuevo' && (
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '2rem',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          maxWidth: '900px'
        }}>
          <h2>➕ Nueva Pregunta</h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              Pregunta
            </label>
            <input
              type="text"
              value={formData.pregunta}
              onChange={(e) => setFormData({ ...formData, pregunta: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              placeholder="Ej: ¿Cómo me inscribo?"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              Respuesta
            </label>
            <textarea
              value={formData.respuesta}
              onChange={(e) => setFormData({ ...formData, respuesta: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                minHeight: '150px',
                fontSize: '14px',
                fontFamily: 'system-ui, sans-serif'
              }}
              placeholder="Escribir la respuesta completa..."
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              Área
            </label>
            <select
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">-- Seleccionar área --</option>
              {areas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
              <option value="Nueva Área">+ Crear nueva área</option>
            </select>
            {formData.area === 'Nueva Área' && (
              <input
                type="text"
                placeholder="Nombre de la nueva área"
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  marginTop: '8px'
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleGuardarNueva}
              style={{
                padding: '12px 24px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✓ Guardar pregunta
            </button>
            <button
              onClick={() => {
                setModo('list');
                setFormData({ numero: 0, pregunta: '', respuesta: '', area: '' });
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#e5e7eb',
                color: '#1f2937',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODO: EDITAR */}
      {modo === 'editar' && (
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '2rem',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          maxWidth: '900px'
        }}>
          <h2>✏ Editar Pregunta #{formData.numero}</h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              Pregunta
            </label>
            <input
              type="text"
              value={formData.pregunta}
              onChange={(e) => setFormData({ ...formData, pregunta: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              Respuesta
            </label>
            <textarea
              value={formData.respuesta}
              onChange={(e) => setFormData({ ...formData, respuesta: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                minHeight: '150px',
                fontSize: '14px',
                fontFamily: 'system-ui, sans-serif'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
              Área
            </label>
            <select
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {areas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleGuardarEdicion}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ✓ Guardar cambios
            </button>
            <button
              onClick={() => {
                setModo('list');
                setEditandoId(null);
                setFormData({ numero: 0, pregunta: '', respuesta: '', area: '' });
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#e5e7eb',
                color: '#1f2937',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Footer info */}
      <div style={{
        marginTop: '3rem',
        padding: '1rem',
        backgroundColor: '#f0f9ff',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 <strong>Tips:</strong> Los cambios se guardan automáticamente en Firebase. La página pública se actualiza al instante. Importa CSV con formato: numero|pregunta|respuesta|area
      </div>
    </div>
  );
}
