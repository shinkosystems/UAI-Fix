import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Trash2, PenTool, Loader2, MapPin, ShieldCheck, User } from 'lucide-react';
import { formatCpf } from '../../utils/masks';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { signatureDataUrl: string; cpf: string; latitude: number | null; longitude: number | null; timestamp: string }) => void;
    loading?: boolean;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    loading = false
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);
    const [cpf, setCpf] = useState('');
    const [location, setLocation] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
    const [locationStatus, setLocationStatus] = useState<'loading' | 'success' | 'error'>('loading');

    useEffect(() => {
        if (isOpen) {
            setCpf('');
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                canvas.width = canvas.parentElement?.clientWidth || 400;
                canvas.height = 160;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                }
                setHasSigned(false);
            }

            // Capturar geolocalização do dispositivo
            if (navigator.geolocation) {
                setLocationStatus('loading');
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setLocation({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                        setLocationStatus('success');
                    },
                    (error) => {
                        console.warn("Geolocalização não concedida ou indisponível:", error);
                        setLocationStatus('error');
                    },
                    { timeout: 10000, enableHighAccuracy: true }
                );
            } else {
                setLocationStatus('error');
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        setHasSigned(true);

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSigned(false);
    };

    const handleConfirm = () => {
        const canvas = canvasRef.current;
        const signatureDataUrl = (canvas && hasSigned) ? canvas.toDataURL('image/png') : '';
        const timestamp = new Date().toISOString();

        onConfirm({
            signatureDataUrl,
            cpf: cpf.trim(),
            latitude: location.lat,
            longitude: location.lng,
            timestamp
        });
    };

    const isValidCpf = cpf.replace(/\D/g, '').length === 11;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 flex flex-col gap-5 max-h-[95vh] overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2.5 bg-blue-50 text-ios-blue rounded-2xl"><PenTool size={20} /></div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Assinatura Digital Jurídica</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Aceite com Validade Legal</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"><X size={18} /></button>
                </div>

                <div className="space-y-4">
                    {/* Campo CPF */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                            <User size={12} /> CPF do Titular (Confirmação de Identidade)
                        </label>
                        <input
                            type="text"
                            placeholder="000.000.000-00"
                            maxLength={14}
                            value={cpf}
                            onChange={(e) => setCpf(formatCpf(e.target.value))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                        />
                    </div>

                    {/* Bloco de Metadados Jurídicos (Geolocalização e Timestamp) */}
                    <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-blue-900">
                            <MapPin size={16} className="text-ios-blue flex-shrink-0" />
                            <div>
                                <p className="font-bold text-[11px]">Geolocalização e Horário</p>
                                <p className="text-[10px] text-blue-700 font-mono">
                                    {locationStatus === 'loading' && 'Obtendo localização GPS...'}
                                    {locationStatus === 'success' && `Lat: ${location.lat?.toFixed(4)}, Lng: ${location.lng?.toFixed(4)}`}
                                    {locationStatus === 'error' && 'Localização não disponível'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white px-2.5 py-1 rounded-xl border border-blue-100 text-[10px] font-black text-blue-800">
                            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>

                    {/* Espaço de Assinatura (Opcional) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assinatura Manuscrita (Opcional)</label>
                        <div className="border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50 overflow-hidden relative touch-none">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full cursor-crosshair bg-white"
                            />
                            {!hasSigned && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-300 text-xs font-bold uppercase tracking-widest">
                                    Desenhe sua assinatura (opcional)
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between items-center px-1">
                            {hasSigned ? (
                                <button onClick={clearCanvas} className="text-xs font-black text-red-500 uppercase tracking-wider flex items-center gap-1 hover:underline">
                                    <Trash2 size={14} /> Limpar Desenho
                                </button>
                            ) : <span />}
                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                <ShieldCheck size={12} className="text-green-600" /> Criptografia Segura
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                    <button
                        onClick={handleConfirm}
                        disabled={!isValidCpf || loading}
                        className="w-full bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <><Check size={16} /><span>Confirmar Aceite e Assinatura</span></>}
                    </button>
                    <button onClick={onClose} className="w-full bg-gray-50 text-gray-500 py-3 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
