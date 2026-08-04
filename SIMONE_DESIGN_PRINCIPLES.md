# SIMONE Design Principles

This document describes the intended visual language of SIMONE.

It intentionally does not describe implementation details.

Implementation may evolve. The principles described here should remain stable and guide future rendering decisions.

## What SIMONE is

SIMONE is not a cloth simulation.

It is a deliberately synthetic real-time projection that immediately reads as a curtain while remaining recognizably computer-generated.

The goal is visual coherence rather than physical realism.

## Design philosophy

Every visual rule should be simple and internally consistent.

When realism and consistency conflict, consistency wins.

SIMONE is inventing its own projection language rather than reproducing physics.

## The curtain

The curtain is composed of many independent vertical artwork strips.

Those strips create the illusion of folds.

The folds are not expected to behave exactly like real fabric.

They should simply feel convincing.

## Authoritative geometry

The existing lower fold profile is the authoritative geometry.

Future rendering experiments should preserve this profile unless the purpose of the experiment is explicitly to redesign the curtain geometry itself.

The lower silhouette is visually more important than the upper silhouette.

## Strip projection

Artwork strips should be thought of as independent vertical ribbons.

Each ribbon is attached to the existing lower fold profile.

Perspective should emerge from the relationship between ribbons rather than from a global deformation of the artwork.

## Swing

The original ambition was a curtain that appears to swing.

A physically correct swing is outside the intended scope.

Future work may suggest the impression of swing through projection rather than cloth simulation.

## Hero

The curtain is the hero image of the exhibition landing page.

It should behave like a calm introduction rather than a spectacular animation.

Interaction should invite exploration without demanding attention.

## Development philosophy

Rendering experiments should always be isolated.

Start from a stable baseline.

Introduce one visual idea.

Evaluate it.

Keep it or revert it completely.

Avoid combining multiple experimental ideas in a single change.

## What SIMONE is not

SIMONE is not a cloth simulator.

SIMONE is not a physics engine.

SIMONE is not intended to reproduce real fabric.

SIMONE is not an animation demo.

SIMONE is an exhibition interface whose introduction happens to be an interactive curtain.
