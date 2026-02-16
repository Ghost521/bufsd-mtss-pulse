import React from 'react';
import { Tier } from '../types';

interface TierData {
  tier: Tier;
  count: number;
  percentage: number;
}

interface TierDistributionProps {
  data: TierData[];
}

export const TierDistribution: React.FC<TierDistributionProps> = ({ data }) => {
  
  const getColor = (tier: Tier) => {
    switch(tier) {
        case Tier.TIER_1: return 'bg-emerald-400';
        case Tier.TIER_2: return 'bg-amber-400';
        case Tier.TIER_3: return 'bg-rose-400';
    }
  }

  const getBgColor = (tier: Tier) => {
    switch(tier) {
        case Tier.TIER_1: return 'bg-emerald-100';
        case Tier.TIER_2: return 'bg-amber-100';
        case Tier.TIER_3: return 'bg-rose-100';
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      <h3 className="font-bold text-slate-800 mb-6">Tier Distribution</h3>
      
      <div className="space-y-6">
        {data.map((item) => (
          <div key={item.tier}>
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-semibold text-slate-700">{item.tier}</span>
              <div className="text-right">
                <span className="text-sm font-bold text-slate-800">{item.count}</span>
                <span className="text-xs text-slate-400 ml-1">students ({item.percentage}%)</span>
              </div>
            </div>
            <div className={`w-full h-3 rounded-full ${getBgColor(item.tier)}`}>
              <div 
                className={`h-3 rounded-full ${getColor(item.tier)} transition-all duration-1000 ease-out`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};