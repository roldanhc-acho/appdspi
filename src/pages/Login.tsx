import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Mail, Lock, Loader2, KeyRound, ArrowLeft } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

export default function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const [message, setMessage] = useState("")
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [confirmPassword, setConfirmPassword] = useState("")
    const { session } = useAuth()
    const navigate = useNavigate()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage("")

        if (isChangingPassword) {
            if (password !== confirmPassword) {
                setMessage("Las contraseñas no coinciden")
                setLoading(false)
                return
            }

            const { error } = await supabase.auth.updateUser({
                password: password
            })

            if (error) {
                setMessage(error.message)
            } else {
                setMessage("¡Contraseña actualizada con éxito!")
                setPassword("")
                setConfirmPassword("")
                setTimeout(() => setIsChangingPassword(false), 2000)
            }
        } else if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: email.split("@")[0],
                    },
                },
            })

            if (error) {
                setMessage(error.message)
            } else {
                setMessage("¡Revisa tu correo para confirmar tu cuenta!")
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                setMessage(error.message)
            } else {
                navigate("/")
            }
        }
        setLoading(false)
    }

    return (
        <div className="flex min-h-screen w-full bg-slate-900">
            {/* Left Panel - Info & Branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative bg-slate-900 text-white">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-20">
                        {/* Logo Container */}
                        <div className="h-32 w-auto bg-white rounded-sm flex items-center justify-center p-2">
                            <img src="/logo.png" alt="DSPI Logo" className="h-full w-auto object-contain" />
                        </div>
                    </div>

                    <h1 className="text-5xl font-bold leading-tight mb-6">
                        Sistema de Gestión <br />
                        de Horas y Proyectos
                    </h1>

                    <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
                        Administra tu tiempo, proyectos y equipo de manera eficiente.
                        Control total sobre jornadas, vacaciones y productividad.
                    </p>
                </div>

                <div className="relative z-10 text-sm text-slate-500">
                    © 2026 DSPI &nbsp;•&nbsp; Todos los derechos reservados
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold text-slate-900">Bienvenido</h2>
                        <p className="text-slate-500">Inicia sesión o crea una cuenta para continuar</p>
                    </div>

                    {/* Tabs / Toggle */}
                    {!isChangingPassword ? (
                        <div className="bg-slate-100 p-1 rounded-lg grid grid-cols-2 gap-1 mb-8">
                            <button
                                onClick={() => { setIsSignUp(false); setMessage(""); }}
                                className={`py-2 text-sm font-medium rounded-md transition-all ${!isSignUp ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                Iniciar Sesión
                            </button>
                            <button
                                onClick={() => { setIsSignUp(true); setMessage(""); }}
                                className={`py-2 text-sm font-medium rounded-md transition-all ${isSignUp ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                            >
                                Registrarse
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 mb-8">
                            <button
                                onClick={() => { setIsChangingPassword(false); setMessage(""); }}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5 text-slate-600" />
                            </button>
                            <h3 className="text-xl font-semibold text-slate-900">Cambiar Contraseña</h3>
                        </div>
                    )}

                    {message && (
                        <div className={`p-4 rounded-lg text-sm ${message.includes("confirmar") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-5">
                        {!isChangingPassword && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="tu@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-slate-400 text-slate-900"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">
                                {isChangingPassword ? "Nueva Contraseña" : "Contraseña"}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-slate-400 text-slate-900"
                                />
                            </div>
                        </div>

                        {isChangingPassword && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Confirmar Nueva Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-slate-400 text-slate-900"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full ${isChangingPassword ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-[#E50914] hover:bg-[#b8070f] shadow-red-600/20'} text-white font-semibold py-2.5 rounded-lg transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg`}
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isChangingPassword ? "Actualizar Contraseña" : (isSignUp ? "Registrarse" : "Iniciar Sesión")}
                        </button>

                        {!isChangingPassword && !isSignUp && session && (
                            <button
                                type="button"
                                onClick={() => { setIsChangingPassword(true); setMessage(""); setPassword(""); }}
                                className="w-full text-center text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center justify-center gap-2 py-2"
                            >
                                <KeyRound className="h-4 w-4" />
                                Cambiar mi contraseña
                            </button>
                        )}
                    </form>

                    <div className="text-center text-xs text-slate-400 mt-8">
                        Sistema interno de gestión operativa
                    </div>
                </div>
            </div>
        </div>
    )
}
