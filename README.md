# Kaloryx by ABG

Tu asistente fitness personal — seguimiento de calorías, entrenamientos y progreso.

---

## Estructura del proyecto

```
kaloryx/
├── index.html        ← App principal
├── css/
│   └── style.css     ← Sistema de diseño completo
├── js/
│   └── app.js        ← Lógica de la app
└── README.md
```

---

## Despliegue en Vercel (paso a paso)

### 1. Crear cuenta en GitHub
Si no tienes una, ve a https://github.com y crea una cuenta gratuita.

### 2. Subir el proyecto a GitHub
1. En GitHub, haz clic en **"New repository"**
2. Nómbralo `kaloryx`
3. Hazlo **Public** (o Private si prefieres)
4. Haz clic en **"Create repository"**
5. Sube los archivos: arrastra la carpeta `kaloryx` completa o usa Git

Con Git desde tu computadora:
```bash
cd kaloryx
git init
git add .
git commit -m "🚀 Kaloryx v1 - initial release"
git remote add origin https://github.com/TU_USUARIO/kaloryx.git
git push -u origin main
```

### 3. Conectar con Vercel
1. Ve a https://vercel.com y crea una cuenta (puedes iniciar sesión con GitHub)
2. Haz clic en **"Add New Project"**
3. Selecciona el repositorio `kaloryx`
4. Vercel lo detecta automáticamente como proyecto estático
5. Haz clic en **"Deploy"**
6. En ~30 segundos tendrás tu app en: `https://kaloryx.vercel.app`

### 4. Configurar la API Key de Anthropic (para las funciones de IA)

La app usa Claude de Anthropic para:
- Estimar calorías por descripción de texto
- Analizar fotos de alimentos

Para que funcionen en producción, necesitas una API key:

1. Ve a https://console.anthropic.com y crea una cuenta
2. En **"API Keys"**, genera una nueva key
3. En tu proyecto de Vercel, ve a **Settings → Environment Variables**
4. Agrega:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-xxxxxxxxxxxxxxxx` (tu key)

> ⚠️ **Importante:** La versión actual llama a la API directamente desde el navegador.
> Para producción segura, se recomienda crear un endpoint serverless en Vercel
> que actúe como proxy y proteja tu API key. Ver sección "Próximos pasos".

### 5. Dominio personalizado (opcional)
En Vercel → Settings → Domains, puedes agregar un dominio propio como `kaloryx.com`.

---

## Funcionalidades actuales (v1)

- ✅ Dashboard con balance calórico diario
- ✅ Registro manual de comidas
- ✅ Estimación de calorías con IA (descripción de texto)
- ✅ Análisis de fotos de alimentos con IA
- ✅ Registro de entrenamientos (Pesas, Cardio, Calistenia, Funcional)
- ✅ Sugerencias de actividades por tipo
- ✅ Duración en horas y minutos con estimación de quema calórica
- ✅ Perfil de usuario con cálculo de BMR (Mifflin-St Jeor)
- ✅ Historial de peso corporal
- ✅ Modo oscuro / claro
- ✅ Datos guardados localmente (localStorage)
- ✅ Diseño responsivo optimizado para móvil

---

## Próximos pasos planeados (v2)

- [ ] Autenticación con Supabase (email / Google)
- [ ] Base de datos en la nube (historial multi-dispositivo)
- [ ] Proxy serverless para API key segura en Vercel
- [ ] Historial diario / semanal con gráficas de progreso
- [ ] Registro de macros (proteínas, carbohidratos, grasas)
- [ ] Biblioteca de ejercicios con calorías predefinidas
- [ ] Notificaciones / recordatorios diarios
- [ ] PWA (instalable como app nativa desde el navegador)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Tipografía | Syne (display) + DM Sans (cuerpo) — Google Fonts |
| IA | Claude API (Anthropic) — claude-sonnet-4 |
| Storage actual | localStorage (navegador) |
| Storage futuro | Supabase (PostgreSQL) |
| Hosting | Vercel |

---

## Soporte

Desarrollado por ABG · Kaloryx v1.0
