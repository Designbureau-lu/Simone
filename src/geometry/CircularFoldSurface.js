import { OpeningResponsiveSurface } from "./OpeningResponsiveSurface.js";

/** Constant-length circular-arc geometry for repeating folds. */
export class CircularFoldSurface extends OpeningResponsiveSurface {
    frameFor(artwork, curtainField) {
        const uniform = curtainField.hasUniformVisibleFactor();
        const geometryByParameters = new Map();
        let cumulativeOffset = 0;

        this.periods = Object.freeze(curtainField.periods.map(
            (fieldPeriod, index) => {
                const parameters = curtainField.resolvedParametersAt(
                    fieldPeriod.index
                );

                if (!geometryByParameters.has(parameters)) {
                    geometryByParameters.set(
                        parameters,
                        resolvePeriod(parameters)
                    );
                }

                const period = geometryByParameters.get(parameters);
                const projectedOffset = uniform
                    ? index * period.projectedWidth
                    : cumulativeOffset;

                cumulativeOffset += period.projectedWidth;

                return Object.freeze({
                    ...period,
                    projectedOffset
                });
            }
        ));

        const depthExtent = Math.max(
            ...this.periods.map((period) => period.depthExtent)
        );

        return Object.freeze({
            width: artwork.width,
            height: artwork.height + 2 * depthExtent
        });
    }

    mapColumn(column, curtainField) {
        void curtainField;
        const sourceX = column.sourceX;
        const artworkPeriodLength = this.periods[0].artworkPeriodLength;
        const periodIndex = Math.floor(sourceX / artworkPeriodLength);
        const period = this.periods[periodIndex];
        const distanceAlongPeriod = sourceX
            - periodIndex * artworkPeriodLength;
        const isFront = period.rearArtworkLength === 0
            || distanceAlongPeriod < period.frontArtworkLength;
        const arc = isFront ? period.frontArc : period.rearArc;
        const artworkLength = isFront
            ? period.frontArtworkLength
            : period.rearArtworkLength;
        const orientation = isFront ? -1 : 1;
        const distanceAlongFold = arc.materialLength
            * (isFront
                ? distanceAlongPeriod
                : distanceAlongPeriod - period.frontArtworkLength)
            / artworkLength;
        const placement = placeOnArc(distanceAlongFold, orientation, arc);
        const foldOffset = isFront ? 0 : period.frontArc.chordLength;
        const targetX = period.horizontalOffset
            + period.projectedOffset
            + foldOffset
            + placement.x;
        const targetY = period.depthExtent + placement.y;
        const branch = isFront ? "front" : "rear";
        const alpha = isFront ? 1 : period.rearAlpha;

        return createPlacement(
            sourceX,
            targetX,
            targetY,
            placement.slope,
            branch,
            alpha,
            arc.chordLength
        );
    }
}

function resolvePeriod(parameters) {
    const foldMaterialLength = parameters.carrierDistance;
    const projectedWidth = parameters.projectedCarrierSpacing;
    const progress = parameters.foldProgress;
    const frontBalance = 0.5 + 0.5 * progress;
    const rearBalance = 0.5 - 0.5 * progress;
    const frontMaterialLength = foldMaterialLength * frontBalance;
    const rearMaterialLength = foldMaterialLength * rearBalance;
    const frontArc = resolveArc(
        frontMaterialLength,
        projectedWidth * frontBalance
    );
    const rearArc = rearBalance === 0
        ? resolveHiddenArc(0)
        : resolveArc(rearMaterialLength, projectedWidth * rearBalance);

    return Object.freeze({
        foldMaterialLength,
        artworkPeriodLength: foldMaterialLength,
        frontArtworkLength: foldMaterialLength * frontBalance,
        rearArtworkLength: foldMaterialLength * rearBalance,
        projectedWidth,
        frontArc,
        rearArc,
        rearAlpha: progress < 1 ? 1 : 0,
        horizontalOffset: foldMaterialLength / (2 * Math.PI),
        depthExtent: foldMaterialLength / Math.PI
    });
}

function resolveArc(materialLength, chordLength) {
    const chordRatio = clamp(chordLength / materialLength, 0, 1);
    const physicalAngle = solveCentralAngle(chordRatio);

    if (physicalAngle === 0) {
        return Object.freeze({
            materialLength,
            chordLength,
            angle: 0,
            radius: Infinity
        });
    }

    const radius = materialLength / physicalAngle;
    const angle = physicalAngle <= Math.PI
        ? physicalAngle
        : 2 * Math.PI - physicalAngle;

    return Object.freeze({
        materialLength,
        chordLength,
        angle,
        radius
    });
}

function resolveHiddenArc(materialLength) {
    return Object.freeze({
        materialLength,
        chordLength: 0,
        angle: 0,
        radius: Infinity,
        hidden: true
    });
}

function solveCentralAngle(chordRatio) {
    if (chordRatio >= 1) {
        return 0;
    }

    let lower = 0;
    let upper = 2 * Math.PI;

    for (let iteration = 0; iteration < 60; iteration += 1) {
        const middle = (lower + upper) / 2;
        const middleRatio = 2 * Math.sin(middle / 2) / middle;

        if (middleRatio > chordRatio) {
            lower = middle;
        } else {
            upper = middle;
        }
    }

    return (lower + upper) / 2;
}

function placeOnArc(distanceAlongFold, orientation, arc) {
    if (arc.hidden) {
        return Object.freeze({ x: 0, y: 0, slope: 0 });
    }

    if (arc.angle === 0) {
        return Object.freeze({
            x: arc.chordLength * distanceAlongFold / arc.materialLength,
            y: 0,
            slope: 0
        });
    }

    const halfAngle = arc.angle / 2;
    const angle = -halfAngle
        + arc.angle * distanceAlongFold / arc.materialLength;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);

    return Object.freeze({
        x: arc.radius * (sine + Math.sin(halfAngle)),
        y: orientation * arc.radius * (cosine - Math.cos(halfAngle)),
        slope: -orientation * sine / cosine
    });
}

export function createPlacement(
    sourceX,
    targetX,
    targetY,
    localSlope,
    branch,
    alpha,
    allocatedWidth
) {
    return Object.freeze({
        sourceX,
        targetX,
        targetY,
        localSlope,
        branch,
        alpha,
        allocatedWidth
    });
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}
