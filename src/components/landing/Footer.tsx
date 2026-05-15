'use client';

import React from 'react';
import { Share2 } from 'lucide-react';
import fincaData from '@config/finca.json';
import socials from '@config/socials.json';

export default function Footer() {
  const airbnbUrl = socials.airbnb;

  const [shareUrl, setShareUrl] = React.useState('');
  const [wind, setWind] = React.useState({ speed: 18, deg: 270 });

  React.useEffect(() => {
    setShareUrl(window.location.href);

    const interval = setInterval(() => {
      setWind((prev) => ({
        speed: Math.max(10, Math.min(45, Number((prev.speed + (Math.random() - 0.5) * 2).toFixed(1)))),
        deg: (prev.deg + Math.floor((Math.random() - 0.5) * 10)) % 360,
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: fincaData.name,
          text: `Discover this coastal sanctuary in ${fincaData.subtitle}.`,
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <footer className="py-12 px-8 bg-white border-t border-slate-100">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
        <div className="flex flex-col items-center md:items-start">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-[0.3em]">{fincaData.name}</span>
          <span className="text-[10px] font-mono text-slate-300 uppercase mt-1 tracking-widest">Est. {fincaData.est}</span>
        </div>

        <div className="flex items-center gap-12">
          <a
            href={airbnbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 opacity-30 hover:opacity-100 transition-all duration-500"
          >
            <svg viewBox="0 0 32 32" className="w-5 h-5 fill-slate-900 group-hover:fill-[#FF5A5F] transition-colors" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 1c2.008 0 3.463.963 4.751 3.269l.533 1.025c1.954 3.83 6.114 12.54 7.1 14.836l.145.353c.667 1.591.91 2.472.96 3.396l.01.415.001.228c0 4.062-2.877 6.478-6.357 6.478-2.224 0-4.556-1.258-6.709-3.386l-.257-.26-.172-.179h-.011l-.176.185c-2.044 2.1-4.393 3.405-6.701 3.405-3.48 0-6.358-2.416-6.358-6.478 0-1.541.353-2.651 1.135-4.433l.128-.292c.621-1.391 3.945-8.158 8.012-15.688l.459-.854C12.537 1.963 13.992 1 16 1zm0 2c-1.232 0-2.04.536-3.003 2.259l-.49 1.011c-4.414 8.167-7.652 14.862-8.087 15.836l-.083.19c-.611 1.397-.837 2.146-.837 3.226 0 2.872 1.942 4.478 4.358 4.478 1.636 0 3.382-.93 5.093-2.684l.325-.343.43-.456.002-.001.002.001.431.456.326.343c1.711 1.754 3.457 2.684 5.093 2.684 2.416 0 4.358-1.606 4.358-4.478 0-1.01-.194-1.644-.733-3.031l-.18-.445c-.886-2.052-4.992-10.632-6.914-14.402l-.531-1.02C18.04 3.536 17.232 3 16 3zm.01 10.316l.169.213.111.144c1.196 1.583 2.062 3.195 2.593 4.83l.084.275.05.18.02.083.001.013a4.01 4.01 0 0 1 .012.332c0 2.138-1.468 3.584-3.048 3.584-1.58 0-3.047-1.446-3.047-3.584a4.011 4.011 0 0 1 .012-.332l.001-.013.02-.083.05-.18.084-.275c.531-1.635 1.397-3.247 2.593-4.83l.111-.144z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-[#FF5A5F]">Airbnb</span>
          </a>

          <button
            onClick={handleShare}
            className="group flex items-center gap-2 opacity-30 hover:opacity-100 transition-all duration-500"
          >
            <Share2 className="w-4 h-4 text-slate-900 group-hover:text-ocean" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-ocean">Share</span>
          </button>

          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Check out ${fincaData.name} in ${fincaData.subtitle}: ` + shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 opacity-30 hover:opacity-100 transition-all duration-500"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-slate-900 group-hover:fill-[#25D366] transition-colors" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-[#25D366]">WhatsApp</span>
          </a>
        </div>

        <div className="flex flex-col items-center md:items-end">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em]">{fincaData.subtitle}, {fincaData.location.country}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{wind.speed} KTS • {wind.deg}° Wind</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
