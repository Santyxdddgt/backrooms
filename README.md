# 🚪 BACKROOMS - Web Horror Experience

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)]()
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)]()
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)]()

> **Advertencia:** Este juego contiene efectos visuales intensos, luces parpadeantes y atmósferas de terror psicológico. No recomendado para personas sensibles a la epilepsia fotosensible.

---

## 📖 Descripción

**BACKROOMS** es una experiencia web de terror psicológico inspirada en la famosa creepypasta de "The Backrooms". Sumérgete en un laberinto infinito de espacios liminales donde la realidad se distorsiona y cada nivel es más perturbador que el anterior.

El juego captura la esencia del horror analógico con:
- 📼 Estética VHS retro con efectos de glitch
- 🎭 3 niveles únicos con mecánicas distintas
- 👁️ Sistema de sanidad mental que afecta la percepción
- 🔦 Gestión de recursos (stamina, vidas, coleccionables)
- 📱 Controles táctiles y de teclado
- 🎨 Atmósfera inmersiva con diseño sonoro visual

---

## 🎮 Niveles

### Nivel 1 - Las Salas Amarillas
`index.html`
- Laberinto clásico de paredes amarillas
- Iluminación fluorescente parpadeante
- Primer encuentro con la entidad
- Mecánicas básicas de exploración

### Nivel 2 - Túneles de Tuberías
`level2.html`
- Ambiente industrial oscuro y húmedo
- Sistema de tuberías complejas
- Mayor dificultad de navegación
- Nuevos desafíos de supervivencia

### Nivel 3 - ERROR 404
`level3.html`
- **Experiencia 3D con Three.js**
- Zona de glitch dimensional
- Realidad fragmentada y distorsionada
- Final alternativo del juego

---

## 🕹️ Controles

### Teclado
| Tecla | Acción |
|-------|--------|
| `W` / `↑` | Moverse hacia adelante |
| `S` / `↓` | Moverse hacia atrás |
| `A` / `←` | Moverse a la izquierda |
| `D` / `→` | Moverse a la derecha |
| `Shift` | Correr (consume stamina) |
| `Espacio` | Interactuar / Saltar |
| `M` | Ver mapa / radar |

### Táctil (Mobile)
- 🕹️ **Joystick virtual**: Movimiento del personaje
- 🔘 **Botones de acción**: Correr, interactuar
- 👆 **Gestos**: Navegación por menús

---

## 📊 Sistema de Juego

### Estadísticas del Jugador
- ❤️ **Vidas**: 3 vidas disponibles
- ⚡ **Stamina**: Energía para correr
- 🧠 **Sanidad**: Afecta la percepción visual
- 📦 **Coleccionables**: Objetos ocultos en cada nivel

### HUD (Heads-Up Display)
- Radar de proximidad
- Indicadores de estado en tiempo real
- Contador de coleccionables
- Mensajes de eventos del juego

---

## 🚀 Instalación y Uso

### Opción 1: Servidor Local (Recomendado)
```bash
# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd backrooms

# Usar Python 3
python3 -m http.server 8000

# O con Node.js (npx)
npx serve .
```

### Opción 2: Abrir Directamente
```bash
# Simplemente abre index.html en tu navegador
# Nota: Algunas características pueden requerir servidor HTTP
```

### Opción 3: GitHub Pages
El proyecto puede ser desplegado gratuitamente en GitHub Pages:
1. Ve a Settings > Pages
2. Selecciona la rama `main`
3. Tu juego estará disponible en `https://usuario.github.io/backrooms`

---

## 🛠️ Tecnologías Utilizadas

| Tecnología | Propósito |
|------------|-----------|
| **HTML5** | Estructura semántica del juego |
| **CSS3** | Estilos, animaciones y efectos VHS |
| **JavaScript ES6+** | Lógica del juego y mecánicas |
| **Three.js** | Renderizado 3D para el Nivel 3 |
| **Web Audio API** | (Preparado para) efectos de sonido |

### Características Técnicas
- ✅ Diseño responsive (mobile-first)
- ✅ Sin dependencias externas (excepto Three.js CDN)
- ✅ Código modular y comentado
- ✅ Optimizado para rendimiento
- ✅ Compatible con navegadores modernos

---

## 📁 Estructura del Proyecto

```
backrooms/
├── index.html          # Nivel 1 - Salas Amarillas
├── level2.html         # Nivel 2 - Túneles de Tuberías
├── level3.html         # Nivel 3 - ERROR 404 (3D)
├── README.md           # Documentación
└── assets/             # (Opcional) Recursos adicionales
    ├── images/
    ├── sounds/
    └── textures/
```

---

## 🎨 Características Destacadas

### Efectos Visuales
- 📺 Filtro CRT/VHS con scanlines
- ✨ Glitches programáticos aleatorios
- 💡 Sistema de iluminación dinámica
- 🌫️ Niebla y efectos atmosféricos
- 🔄 Transiciones suaves entre escenas

### Diseño de Sonido Visual
- Indicadores visuales de audio
- Feedback háptico en mobile
- Señales audiovisuales sincronizadas

---

## 🔧 Personalización

### Modificar Dificultad
Edita las variables en el JavaScript de cada nivel:
```javascript
const CONFIG = {
    playerSpeed: 5,
    maxStamina: 100,
    sanityDrainRate: 0.5,
    enemySpawnRate: 0.02
};
```

### Cambiar Estética
Los efectos CSS están organizados por categorías:
- `.vhs-overlay` - Filtros de video
- `.glitch-effect` - Distorsiones
- `.lighting` - Sistemas de luz

---

## 🐛 Problemas Conocidos

- [ ] Algunos efectos pueden no funcionar en navegadores antiguos
- [ ] El Nivel 3 requiere hardware gráfico compatible con WebGL
- [ ] En mobile, el joystick puede necesitar recalibración

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si deseas mejorar el proyecto:

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/mejora`)
3. Commit tus cambios (`git commit -m 'Añadir nueva característica'`)
4. Push a la rama (`git push origin feature/mejora`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es un trabajo fan basado en "The Backrooms" creepypasta.
Desarrollado con fines educativos y de entretenimiento.

---

## 🔗 Enlaces y Recursos

- [The Backrooms Wiki](https://backrooms-wiki.wikidot.com/)
- [Three.js Documentation](https://threejs.org/docs/)
- [MDN Web Docs](https://developer.mozilla.org/)

---

## 👨‍💻 Autor

Proyecto desarrollado como demostración de habilidades en desarrollo web frontend.

**¿Te ha gustado?** ¡Déjame una ⭐ en el repositorio!

---

<div align="center">

**⚠️ NO CLIP OUT OF REALITY ⚠️**

*«Si prestas atención mientras te mueves fuera de los límites de la realidad...»*

</div>
