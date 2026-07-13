# SIMONE

## Project

SIMONE is a Graphic Visibility Simulator.

It is not a curtain simulator.

Its purpose is to evaluate the visibility of graphics applied to periodic wave geometries.

---

## Core Principles

### The artwork is sacred.

SIMONE never redraws artwork.

SIMONE never invents pixels.

SIMONE only remaps existing pixel columns.

---

### Geometry and rendering are independent.

The geometry engine computes where every column is located.

The renderer decides how that geometry is displayed.

---

### Visibility is more important than realism.

SIMONE is a design tool.

It is not a photorealistic renderer.

---

## Units

Internally:
- pixels

User interface:
- millimetres

---

## Rendering

The renderer must be modular.

Future rendering models may include:
- flat projection
- visibility shading
- perspective
- animation

without changing the geometry engine.

---

## Coding

Keep functions small.

Prefer readability over cleverness.

Do not redesign the user interface unless requested.

## Physical model

SIMONE models a real physical wave installation.

The mathematical model must remain compatible with physical dimensions.

Artwork width may exceed 20 metres.

Artwork height is essentially fixed.

The wave profile is periodic.

The artwork is represented by immutable vertical pixel columns.