# 🥖 Stock & Amasado — Obrador Colaborativo
**Panel colaborativo en tiempo real para la gestión de stock de pan y planificación de amasadoras.**
Este sistema está diseñado para obradores y panaderías que trabajan en equipo. Permite controlar el stock de diferentes tipos de pan, planificar consumos diarios (mediante reglas semanales y excepciones), programar amasadoras con antelación y registrar la producción real. Todo sincronizado al instante entre todos los dispositivos del equipo gracias a Firebase.
![Vista principal](https://via.placeholder.com/800x400?text=Captura+de+pantalla+próximamente)
---
## ✨ Características principales
- **Stock en tiempo real** – Actualiza el stock de cada producto y todos los dispositivos ven el cambio al instante.
- **Margen de seguridad por producto** – Define un mínimo para cada tipo de pan y recibe alertas cuando se acerca.
- **Reglas semanales** – Configura el consumo base para cada día de la semana (Desayuno, Comida y Eventos Extra). Fácil edición en una vista semanal completa.
- **Excepciones manuales** – Modifica el consumo de un día concreto sin afectar a la regla semanal (ideal para eventos especiales o cambios de última hora).
- **Planificación de amasadoras** – Programa una amasadora para una fecha determinada y el sistema te recordará al día siguiente que debes registrar la producción real.
- **Registro de producción** – Al día siguiente de la amasadora, la aplicación te muestra un panel para introducir la cantidad real producida; el stock se actualiza automáticamente.
- **Autonomía y órdenes de producción** – Calcula cuántos días durará el stock de cada producto y te avisa cuándo debes empezar a amasar para no romper el stock de seguridad.
- **Calendario visual** – Vista mensual con los consumos previstos, amasadoras programadas y fechas de agotamiento de cada producto.
- **Vista semanal tipo kanban** – Muestra los próximos 7 días en columnas, con las tareas de consumo y amasadoras programadas.
- **Modo oscuro automático** – Se adapta a la configuración de color del sistema (y permite cambio manual).
- **Registro de actividad** – Quién hizo qué cambio y cuándo (útil para equipos).
- **Sin necesidad de autenticación** – Solo es necesario poner un nombre para identificar los cambios (se guarda en el almacenamiento local).
---
## 🛠️ Tecnologías utilizadas
- **HTML5 + CSS3 + JavaScript (Vanilla)**
- **TailwindCSS** – Para el diseño y la maquetación responsiva.
- **Firebase Realtime Database** – Para la sincronización en tiempo real entre dispositivos.
- **Fuentes de Google** – Playfair Display y Plus Jakarta Sans.
- **LocalStorage** – Para guardar el nombre del usuario y preferencias de modo oscuro.
---
## 🚀 Instalación y puesta en marcha
### 1. Clona o descarga el repositorio
```bash
git clone https://github.com/tu-usuario/stock-amasado-obrador.git
cd stock-amasado-obrador
