'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaPlus, FaEdit, FaTrash, FaEye, FaEyeSlash, FaCopy, 
  FaGift, FaBolt, FaMoneyBillWave, FaUsers, FaChartLine,
  FaCalendarAlt, FaPercentage, FaToggleOn, FaToggleOff
} from 'react-icons/fa';
import { toast } from 'sonner';

// Types
interface PromoCode {
  id: string;
  code: string;
  cash_amount: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface DirectBonus {
  id: string;
  name: string;
  description: string;
  bonus_percentage: number;
  min_bet_amount: number;
  max_uses_per_user: number | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  total_applications: number;
  total_bonus_given_cop: number;
}

const AdminPromotionsDashboard = () => {
  // State
  const [activeTab, setActiveTab] = useState<'codes' | 'bonuses' | 'analytics'>('codes');
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [directBonuses, setDirectBonuses] = useState<DirectBonus[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreateCode, setShowCreateCode] = useState(false);
  const [showCreateBonus, setShowCreateBonus] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [editingBonus, setEditingBonus] = useState<DirectBonus | null>(null);

  // Fetch data
  useEffect(() => {
    fetchPromotionalData();
  }, []);

  const fetchPromotionalData = async () => {
    setLoading(true);
    try {
      // Fetch promo codes
      const codesRes = await fetch('/api/admin/promo-codes');
      const codes = await codesRes.json();
      setPromoCodes(codes);

      // Fetch direct bonuses
      const bonusesRes = await fetch('/api/admin/direct-bonuses');
      const bonuses = await bonusesRes.json();
      setDirectBonuses(bonuses);
    } catch (error) {
      toast.error('Error loading promotional data');
    } finally {
      setLoading(false);
    }
  };

  // Promo Code Management
  const createPromoCode = async (data: {
    code: string;
    cash_amount: number;
    max_uses: number;
    expires_at?: string;
  }) => {
    try {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        toast.success('Código promocional creado');
        fetchPromotionalData();
        setShowCreateCode(false);
      } else {
        toast.error('Error creando código');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const togglePromoCode = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });
      
      if (res.ok) {
        toast.success(`Código ${!isActive ? 'activado' : 'desactivado'}`);
        fetchPromotionalData();
      }
    } catch (error) {
      toast.error('Error actualizando código');
    }
  };

  // Direct Bonus Management
  const createDirectBonus = async (data: {
    name: string;
    description: string;
    bonus_percentage: number;
    min_bet_amount: number;
    max_uses_per_user?: number;
    starts_at: string;
    ends_at?: string;
  }) => {
    try {
      const res = await fetch('/api/admin/direct-bonuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        toast.success('Bono directo creado');
        fetchPromotionalData();
        setShowCreateBonus(false);
      } else {
        toast.error('Error creando bono');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const toggleDirectBonus = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/direct-bonuses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });
      
      if (res.ok) {
        toast.success(`Bono ${!isActive ? 'activado' : 'desactivado'}`);
        fetchPromotionalData();
      }
    } catch (error) {
      toast.error('Error actualizando bono');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  // Summary stats
  const totalActivePromoCodes = promoCodes.filter(code => code.is_active).length;
  const totalActiveDirectBonuses = directBonuses.filter(bonus => bonus.is_active).length;
  const totalPromoCodesRedeemed = promoCodes.reduce((sum, code) => sum + code.used_count, 0);
  const totalDirectBonusGiven = directBonuses.reduce((sum, bonus) => sum + bonus.total_bonus_given_cop, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Panel de Promociones</h1>
          <p className="text-gray-400">Gestiona códigos promocionales y bonos directos</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm">Códigos Activos</p>
                <p className="text-2xl font-bold text-white">{totalActivePromoCodes}</p>
              </div>
              <FaGift className="text-green-400 text-2xl" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-sm">Bonos Directos Activos</p>
                <p className="text-2xl font-bold text-white">{totalActiveDirectBonuses}</p>
              </div>
              <FaBolt className="text-blue-400 text-2xl" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-400 text-sm">Códigos Canjeados</p>
                <p className="text-2xl font-bold text-white">{totalPromoCodesRedeemed}</p>
              </div>
              <FaUsers className="text-purple-400 text-2xl" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-amber-900/20 to-orange-900/20 border border-amber-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-400 text-sm">Bonos Dados (COP)</p>
                <p className="text-2xl font-bold text-white">${totalDirectBonusGiven.toLocaleString('es-CO')}</p>
              </div>
              <FaMoneyBillWave className="text-amber-400 text-2xl" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('codes')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'codes'
                ? 'bg-green-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaGift className="inline mr-2" />
            Códigos Promocionales
          </button>
          <button
            onClick={() => setActiveTab('bonuses')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'bonuses'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaBolt className="inline mr-2" />
            Bonos Directos
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FaChartLine className="inline mr-2" />
            Analytics
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'codes' && (
          <div>
            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Códigos Promocionales</h2>
              <button
                onClick={() => setShowCreateCode(true)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <FaPlus /> Crear Código
              </button>
            </div>

            {/* Promo Codes Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Monto (COP)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Usos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Vence
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-600">
                    {promoCodes.map((code) => (
                      <tr key={code.id} className="hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-green-400">{code.code}</span>
                            <button
                              onClick={() => copyToClipboard(code.code)}
                              className="text-gray-400 hover:text-white"
                            >
                              <FaCopy />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-white font-semibold">
                            ${code.cash_amount.toLocaleString('es-CO')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-300">
                            {code.used_count} / {code.max_uses}
                          </span>
                          <div className="w-full bg-gray-600 rounded-full h-1 mt-1">
                            <div 
                              className="bg-blue-500 h-1 rounded-full" 
                              style={{width: `${(code.used_count / code.max_uses) * 100}%`}}
                            ></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {code.expires_at 
                            ? new Date(code.expires_at).toLocaleDateString('es-CO')
                            : 'Sin límite'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            code.is_active 
                              ? 'bg-green-900 text-green-300' 
                              : 'bg-red-900 text-red-300'
                          }`}>
                            {code.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePromoCode(code.id, code.is_active)}
                              className={`p-2 rounded ${
                                code.is_active ? 'text-red-400 hover:bg-red-900/20' : 'text-green-400 hover:bg-green-900/20'
                              }`}
                            >
                              {code.is_active ? <FaEyeSlash /> : <FaEye />}
                            </button>
                            <button
                              onClick={() => setEditingCode(code)}
                              className="p-2 text-blue-400 hover:bg-blue-900/20 rounded"
                            >
                              <FaEdit />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bonuses' && (
          <div>
            {/* Actions Bar */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Bonos Directos de Apuesta</h2>
              <button
                onClick={() => setShowCreateBonus(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <FaPlus /> Crear Bono
              </button>
            </div>

            {/* Direct Bonuses Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Campaña
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Bono %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Apuesta Mín.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Vigencia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Aplicaciones
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-600">
                    {directBonuses.map((bonus) => (
                      <tr key={bonus.id} className="hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-white">{bonus.name}</div>
                            <div className="text-sm text-gray-400">{bonus.description}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-blue-400 font-bold text-lg">
                            {bonus.bonus_percentage}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          ${bonus.min_bet_amount.toLocaleString('es-CO')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          <div className="text-sm">
                            {new Date(bonus.starts_at).toLocaleDateString('es-CO')}
                            {bonus.ends_at && (
                              <>
                                <br />
                                hasta {new Date(bonus.ends_at).toLocaleDateString('es-CO')}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-300">
                            <div>{bonus.total_applications} usos</div>
                            <div className="text-sm text-green-400">
                              ${bonus.total_bonus_given_cop.toLocaleString('es-CO')} dados
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            bonus.is_active 
                              ? 'bg-blue-900 text-blue-300' 
                              : 'bg-red-900 text-red-300'
                          }`}>
                            {bonus.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleDirectBonus(bonus.id, bonus.is_active)}
                              className={`p-2 rounded ${
                                bonus.is_active 
                                  ? 'text-red-400 hover:bg-red-900/20' 
                                  : 'text-green-400 hover:bg-green-900/20'
                              }`}
                            >
                              {bonus.is_active ? <FaToggleOff /> : <FaToggleOn />}
                            </button>
                            <button
                              onClick={() => setEditingBonus(bonus)}
                              className="p-2 text-blue-400 hover:bg-blue-900/20 rounded"
                            >
                              <FaEdit />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Analytics & Reportes</h2>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all">
                <div className="text-lg font-semibold mb-2">Crear Código Masivo</div>
                <div className="text-sm opacity-90">Generar múltiples códigos promocionales</div>
              </button>
              
              <button className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all">
                <div className="text-lg font-semibold mb-2">Campaña de Fin de Semana</div>
                <div className="text-sm opacity-90">Crear bono automático para weekends</div>
              </button>
              
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all">
                <div className="text-lg font-semibold mb-2">Exportar Reportes</div>
                <div className="text-sm opacity-90">Descargar analytics en Excel</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Promo Code Modal */}
      {showCreateCode && (
        <CreatePromoCodeModal
          onClose={() => setShowCreateCode(false)}
          onSubmit={createPromoCode}
        />
      )}

      {/* Create Direct Bonus Modal */}
      {showCreateBonus && (
        <CreateDirectBonusModal
          onClose={() => setShowCreateBonus(false)}
          onSubmit={createDirectBonus}
        />
      )}
    </div>
  );
};

// Create Promo Code Modal Component
const CreatePromoCodeModal = ({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: any) => void;
}) => {
  const [formData, setFormData] = useState({
    code: '',
    cash_amount: 10000,
    max_uses: 100,
    expires_at: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      expires_at: formData.expires_at || undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md"
      >
        <h3 className="text-xl font-semibold mb-4">Crear Código Promocional</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Código</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="ej: WELCOME2024"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Monto en COP</label>
            <input
              type="number"
              value={formData.cash_amount}
              onChange={(e) => setFormData({...formData, cash_amount: Number(e.target.value)})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              min="1000"
              step="1000"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Máximo de Usos</label>
            <input
              type="number"
              value={formData.max_uses}
              onChange={(e) => setFormData({...formData, max_uses: Number(e.target.value)})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              min="1"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Fecha de Expiración (opcional)</label>
            <input
              type="datetime-local"
              value={formData.expires_at}
              onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
            >
              Crear Código
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
            >
              Cancelar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// Create Direct Bonus Modal Component
const CreateDirectBonusModal = ({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: any) => void;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bonus_percentage: 100,
    min_bet_amount: 10000,
    max_uses_per_user: '',
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      max_uses_per_user: formData.max_uses_per_user ? Number(formData.max_uses_per_user) : undefined,
      ends_at: formData.ends_at || undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl font-semibold mb-4">Crear Bono Directo</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nombre de la Campaña</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              placeholder="ej: Bono Fin de Semana"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              rows={3}
              placeholder="Describe el bono para los usuarios"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Porcentaje de Bono (%)</label>
            <input
              type="number"
              value={formData.bonus_percentage}
              onChange={(e) => setFormData({...formData, bonus_percentage: Number(e.target.value)})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              min="1"
              max="500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Apuesta Mínima (COP)</label>
            <input
              type="number"
              value={formData.min_bet_amount}
              onChange={(e) => setFormData({...formData, min_bet_amount: Number(e.target.value)})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              min="1000"
              step="1000"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Usos por Usuario (opcional)</label>
            <input
              type="number"
              value={formData.max_uses_per_user}
              onChange={(e) => setFormData({...formData, max_uses_per_user: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              min="1"
              placeholder="Ilimitado si se deja vacío"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Fecha de Inicio</label>
            <input
              type="datetime-local"
              value={formData.starts_at}
              onChange={(e) => setFormData({...formData, starts_at: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Fecha de Fin (opcional)</label>
            <input
              type="datetime-local"
              value={formData.ends_at}
              onChange={(e) => setFormData({...formData, ends_at: e.target.value})}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
            >
              Crear Bono
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
            >
              Cancelar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminPromotionsDashboard;