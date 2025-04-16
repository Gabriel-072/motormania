'use client';

import Image from 'next/image';
import { DriverStanding, ConstructorStanding, RookieStanding, DestructorStanding, Team } from '@/app/types/standings';

interface StandingsProps {
  driverStandings: DriverStanding[];
  constructorStandings: ConstructorStanding[];
  rookieStandings: RookieStanding[];
  destructorStandings: DestructorStanding[];
  teams: Team[];
}

const Standings = ({ driverStandings, constructorStandings, rookieStandings, destructorStandings, teams }: StandingsProps) => {
  const getEvolutionStyle = (evolution: string) => evolution.startsWith('↑') ? 'text-green-400' : evolution.startsWith('↓') ? 'text-red-400' : 'text-gray-400';
  const getTeamLogo = (teamName: string) => teams.find((team) => team.name === teamName)?.logo_url || '/images/team-logos/default-team.png';
  const formatUSD = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-lg w-full overflow-x-auto">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">Clasificación Pilotos 2025</h2>
        {driverStandings.length > 0 ? (
          <table className="w-full text-white font-exo2 text-sm sm:text-base min-w-[300px]">
            <thead>
              <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                <th className="p-2 text-left">Pos.</th>
                <th className="p-2 text-left">Piloto</th>
                <th className="p-2 text-right">Pts</th>
                <th className="p-2 text-center">Evo.</th>
              </tr>
            </thead>
            <tbody>
              {driverStandings.map((standing) => (
                <tr key={standing.position} className="border-b border-amber-500/20 hover:bg-blue-800/50">
                  <td className="p-2">{standing.position}</td>
                  <td className="p-2 truncate">{standing.driver}</td>
                  <td className="p-2 text-right">{standing.points}</td>
                  <td className={`p-2 text-center ${getEvolutionStyle(standing.evolution)}`}>{standing.evolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-center font-exo2 text-sm sm:text-base">Sin datos disponibles</p>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-lg w-full overflow-x-auto">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">Clasificación Constructores 2025</h2>
        {constructorStandings.length > 0 ? (
          <table className="w-full text-white font-exo2 text-sm sm:text-base min-w-[300px]">
            <thead>
              <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                <th className="p-2 text-left">Pos.</th>
                <th className="p-2 text-left">Constructor</th>
                <th className="p-2 text-right">Pts</th>
                <th className="p-2 text-center">Evo.</th>
              </tr>
            </thead>
            <tbody>
              {constructorStandings.map((standing) => (
                <tr key={standing.position} className="border-b border-amber-500/20 hover:bg-blue-800/50">
                  <td className="p-2">{standing.position}</td>
                  <td className="p-2 flex items-center gap-2 truncate"><Image src={getTeamLogo(standing.constructor)} alt={standing.constructor} width={20} height={20} className="object-contain sm:w-6 sm:h-6" />{standing.constructor}</td>
                  <td className="p-2 text-right">{standing.points}</td>
                  <td className={`p-2 text-center ${getEvolutionStyle(standing.evolution)}`}>{standing.evolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-center font-exo2 text-sm sm:text-base">Sin datos disponibles</p>
        )}
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-lg w-full overflow-x-auto">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">Rookies 2025</h2>
        {rookieStandings.length > 0 ? (
          <table className="w-full text-white font-exo2 text-sm sm:text-base min-w-[300px]">
            <thead>
              <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                <th className="p-2 text-left">Pos.</th>
                <th className="p-2 text-left">Piloto</th>
                <th className="p-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rookieStandings.map((standing) => (
                <tr key={standing.position} className="border-b border-amber-500/20 hover:bg-gray-800/50">
                  <td className="p-2">{standing.position}</td>
                  <td className="p-2 truncate">{standing.driver}</td>
                  <td className="p-2 text-right">{standing.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-center font-exo2 text-sm sm:text-base">Sin datos disponibles</p>
        )}
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 sm:p-6 rounded-xl border border-amber-500/30 shadow-lg w-full overflow-x-auto">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-4 font-exo2 text-center">Destructores 2025</h2>
        {destructorStandings.length > 0 ? (
          <table className="w-full text-white font-exo2 text-sm sm:text-base min-w-[300px]">
            <thead>
              <tr className="bg-gradient-to-r from-amber-500/20 to-cyan-500/20">
                <th className="p-2 text-left">Pos.</th>
                <th className="p-2 text-left">Piloto</th>
                <th className="p-2 text-right">Costos</th>
              </tr>
            </thead>
            <tbody>
              {destructorStandings.map((standing) => (
                <tr key={standing.position} className="border-b border-amber-500/20 hover:bg-gray-800/50">
                  <td className="p-2">{standing.position}</td>
                  <td className="p-2 truncate">{standing.driver}</td>
                  <td className="p-2 text-right">{formatUSD(standing.total_costs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-center font-exo2 text-sm sm:text-base">Sin datos disponibles</p>
        )}
      </div>
    </div>
  );
};

export default Standings;