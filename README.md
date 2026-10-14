## Changes in This Fork

This fork keeps the original firmware working and adds a browser-based simulator
plus a round of visual upgrades. Everything below is on top of the upstream
project.

### Browser simulator

- Fullscreen standalone web view at `?standalone`, running the same aquarium
  engine and framebuffer pipeline as the device.
- Landscape and portrait views; portrait matches the device's 80x106 logical
  frame.
- Selectable dot density: Coarse, Medium, Fine, and Ultra, all finer than the
  original single resolution.
- Render-style toggle between soft Dots and crisp Pixels (nearest-neighbour).
- Day/night cycle driven by the local clock. Night starts fading in at 7pm and
  is fully on at 8pm; it fades back to day from 6am and is fully day at 7am. At
  night the water darkens and the rest of the scene dims.
- Add fish on demand, feed by clicking, fullscreen mode, and a clock overlay.
- An automatic feeder drops two pieces of food per fish, one at a time, at the
  top of every hour, driven by the local clock (toggle with `h`).
- Controls popup (the `?` button, top right) lists every key binding and can be
  toggled with `/`.
- `?hour=21` forces a clock hour so either view can be previewed at any time.

### Scene and visuals

- New reef scenery: sandy substrate over varied terrain, lumpy rocks,
  and multiple coral types (branch, fan, brain, tube, mushroom, and swaying
  anemones).
- Six plants instead of three, each with its own color and height.
- 12-hour AM/PM clock, with the date shown directly under the time.

### Fish

- Three new tropical species, each with its own shape, colors, and movement:
  - **Angelfish**: tall, laterally compressed silver body with charcoal vertical
    bars; slow and graceful.
  - **Clownfish**: orange body with white bands; a medium-paced side-to-side
    waddle.
  - **Neon Tetra**: small and slim with a blue front and red rear stripe; fast
    and darting.
- A new tank starts with six curated fish, including all three new species, so
  the community is visible on first load. Fish added later or bred stay random.
- Fish are kept inside the tank instead of swimming off the edges.

### Tooling

- `npm run build` inlines the web app into `lib/UI/interface.{h,cpp}` for
  the firmware build.
- A GitHub Pages workflow deploys the browser simulator on every push to `main`.


-------------------------------
## Below is the original README
-------------------------------


# ESP32 CYD Aquarium

A little animated pixel aquarium for the ESP32-2432S028R, better known as the
Cheap Yellow Display. It's adapted from
[Livegrid OpenMatrix](https://github.com/livegrid/OpenMatrix).

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License: AGPL-3.0">
  <img src="https://img.shields.io/badge/platform-ESP32--2432S028R-orange.svg" alt="Platform: ESP32-2432S028R">
  <img src="https://img.shields.io/badge/built%20with-PlatformIO-f5822a.svg" alt="Built with PlatformIO">
  <a href="https://ko-fi.com/lagerpun"><img src="https://img.shields.io/badge/Ko--fi-Support-ff5f5f.svg?logo=kofi&logoColor=white" alt="Support on Ko-fi"></a>
</p>

<p align="center">
  <img src="docs/images/cyd-aquarium-demo.gif" alt="ESP32 CYD Aquarium running on a Cheap Yellow Display" width="360">
</p>

<p align="center">
  <a href="docs/images/aquarium.mp4">MP4 video</a>
</p>

It turns one of these small 2.8 inch ESP32 touchscreens into a self-running
desk aquarium: moving water, a handful of small creatures, plants, drifting
food, and a 12-hour clock. Give it Wi-Fi and it syncs the time over NTP; leave
Wi-Fi out and it still runs fine on its own. It also dims its own backlight
using the light sensor already on the board.

It's my own CYD take on the OpenMatrix aquarium, not a straight port of the
original HUB75 RGB matrix project. The default build is just about the screen,
so you don't need any external temperature, humidity, or CO2 sensors to run it.

## What It Does

It boots straight into the scene and keeps itself going without you touching
anything. Bigger creatures swim around while smaller stuff drifts in the
background, and the whole thing is drawn on the TFT in a way that mimics a
small LED matrix.

## Features

- Standalone live aquarium mode for the ESP32-2432S028R / CYD board.
- 240x320 ILI9341 TFT output with an 80x106 logical pixel-aquarium frame.
- Dot-grid renderer that gives the TFT a small LED-matrix look.
- Autonomous fish, stars, turtles, snakes, octopuses, boids, plants, food, and
  animated water.
- 12-hour clock with AM/PM, seconds, and a date overlay.
- Optional Wi-Fi/NTP time sync, with a compile-time fallback when there's no
  network.
- Wi-Fi disconnects on its own after the NTP sync by default.
- Automatic TFT backlight using the onboard GPIO34 light sensor.
- Optional touch-to-feed.
- No external environmental sensors needed for the default build.
- Tested on the common ESP32-2432S028R / Cheap Yellow Display hardware.

## Hardware

Tested on:

| Part | Detail |
| --- | --- |
| Board | ESP32-2432S028R / Cheap Yellow Display style |
| Module | ESP32-WROOM-32 class |
| Display | 2.8 inch 240x320 ILI9341 TFT |
| Touch | XPT2046 resistive |
| Light sensor | Onboard, on GPIO34 |

CYD boards and clones vary. Start with the tested configuration in this repo,
then see [docs/HARDWARE.md](docs/HARDWARE.md) and
[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) if your board behaves
differently.

## Quick Start

Install [PlatformIO](https://platformio.org/) first, then build the default
environment:

```powershell
pio run -e esp32-2432s028r
```

Flash your board, replacing `COMx` with your serial port:

```powershell
pio run -e esp32-2432s028r -t upload --upload-port COMx
```

Open the monitor:

```powershell
pio device monitor --environment esp32-2432s028r --baud 115200 --port COMx
```

Detailed steps are in [docs/BUILD_AND_FLASH.md](docs/BUILD_AND_FLASH.md).

## Wi-Fi and Time

Wi-Fi is optional. Without Wi-Fi credentials, the aquarium still boots and uses
the firmware compile time as a fallback clock.

For NTP time sync, copy:

```text
include/WifiSecrets.example.h
```

to:

```text
include/WifiSecrets.h
```

Then fill in your own Wi-Fi name and password. `WifiSecrets.h` is ignored by
git on purpose.

See [docs/WIFI_TIME.md](docs/WIFI_TIME.md).

## Documentation

- [Hardware notes](docs/HARDWARE.md)
- [Build and flash guide](docs/BUILD_AND_FLASH.md)
- [Wi-Fi and NTP setup](docs/WIFI_TIME.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Development notes](docs/DEVELOPMENT_NOTES.md)
- [Attribution](docs/ATTRIBUTION.md)

## Support ☕

I built this for fun and put it out there for free. If you've enjoyed it and
would like to see it grow, buying me a coffee helps me keep tinkering and adding
new things to it. A star, an issue about your board variant, or a short hardware
report are always welcome too.

<p align="center">
  <a href="https://ko-fi.com/lagerpun">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Buy Me a Coffee at ko-fi.com">
  </a>
</p>

## Attribution

This project is based on
[Livegrid OpenMatrix](https://github.com/livegrid/OpenMatrix), an AGPL-3.0
project for ESP32-driven HUB75 RGB matrices.

I've adapted the aquarium idea and the supporting code for the
ESP32-2432S028R / Cheap Yellow Display TFT board. That meant changing the
display target, the hardware assumptions, the clock behavior, the backlight
handling, and a fair bit of scene tuning for this smaller screen. It isn't an
official Livegrid project.

See [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).

## License

This project is released under the GNU Affero General Public License v3.0
because the upstream OpenMatrix project is AGPL-3.0.

See [LICENSE](LICENSE).
