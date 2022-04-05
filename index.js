/**
 * @typedef {{
 *     width: number,
 *     height: number,
 *     channels?: 3 | 4,
 *     colorspace?: "srgb" | "linear",
 * }} QOIOptions
 */

const colorspaces = {
    srgb: 0,
    linear: 1,
};

const QOI_OP_RGB = 0b11111110;
const QOI_OP_RGBA = 0b11111111;
const QOI_OP_INDEX = 0b00_000000;
const QOI_OP_DIFF = 0b01_000000;
const QOI_OP_LUMA = 0b10_000000;
const QOI_OP_RUN = 0b11_000000;

/**
 * @param {Uint8Array} data
 * @param {QOIOptions} options
 */
export function encode(data, options) {
    const { width, height, channels = 4, colorspace = "srgb" } = options;
    const colorspaceId = colorspaces[colorspace];

    if (data.length !== width * height * channels) {
        throw new Error(`Invalid data size: ${data.byteLength} bytes, expected ${width * height * channels} bytes.`);
    }

    const index = new Uint32Array(64);
    const result = new Uint8Array(14 + width * height * 5);
    let o = 0;

    // Header

    // "qoif"
    result[o++] = 0x71;
    result[o++] = 0x6f;
    result[o++] = 0x69;
    result[o++] = 0x66;

    result[o++] = (width >> 24) & 0xff;
    result[o++] = (width >> 16) & 0xff;
    result[o++] = (width >> 8) & 0xff;
    result[o++] = width & 0xff;

    result[o++] = (height >> 24) & 0xff;
    result[o++] = (height >> 16) & 0xff;
    result[o++] = (height >> 8) & 0xff;
    result[o++] = height & 0xff;

    result[o++] = channels;
    result[o++] = colorspaceId;

    // Data

    let run = 0;

    let r, g, b, a, v;
    let _r = 0x00,
        _g = 0x00,
        _b = 0x00,
        _a = 0xff,
        _v = 0x000000ff;

    for (let i = 0; i < width * height * channels; i += channels, _r = r, _g = g, _b = b, _a = a, _v = v) {
        r = data[i + 0];
        g = data[i + 1];
        b = data[i + 2];
        a = channels === 4 ? data[i + 3] : _a;
        v = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;

        if (v === _v) {
            ++run;

            if (run === 62) {
                result[o++] = QOI_OP_RUN | ((run - 1) & 0b111111);
                run = 0;
            }

            continue;
        } else if (run !== 0) {
            result[o++] = QOI_OP_RUN | ((run - 1) & 0b111111);
            run = 0;
        }

        const indexPos = (r * 3 + g * 5 + b * 7 + a * 11) & 63;

        if (v === index[indexPos]) {
            result[o++] = QOI_OP_INDEX | indexPos;
            continue;
        }

        index[indexPos] = v;

        if (a === _a) {
            const dr = r - _r;
            const dg = g - _g;
            const db = b - _b;

            const _dr = ((dr & 0xff) << 24) >> 24;
            const _dg = ((dg & 0xff) << 24) >> 24;
            const _db = ((db & 0xff) << 24) >> 24;

            if (_dr > -3 && _dr < 2 && _dg > -3 && _dg < 2 && _db > -3 && _db < 2) {
                const __dr = _dr + 2;
                const __dg = _dg + 2;
                const __db = _db + 2;

                result[o++] = QOI_OP_DIFF | (__dr << 4) | (__dg << 2) | __db;
                continue;
            }

            const dr_dg = dr - dg;
            const db_dg = db - dg;

            const _dr_dg = ((dr_dg & 0xff) << 24) >> 24;
            const _db_dg = ((db_dg & 0xff) << 24) >> 24;

            if (_dg > -33 && _dg < 32 && _dr_dg > -9 && _dr_dg < 8 && _db_dg > -9 && _db_dg < 8) {
                const __dg = _dg + 32;
                const __dr_dg = _dr_dg + 8;
                const __db_dg = _db_dg + 8;

                result[o++] = QOI_OP_LUMA | __dg;
                result[o++] = (__dr_dg << 4) | __db_dg;
                continue;
            }

            result[o++] = QOI_OP_RGB;
            result[o++] = r;
            result[o++] = g;
            result[o++] = b;
        } else {
            result[o++] = QOI_OP_RGBA;
            result[o++] = r;
            result[o++] = g;
            result[o++] = b;
            result[o++] = a;
        }
    }

    if (run > 0) {
        result[o++] = QOI_OP_RUN | ((run - 1) & 0b111111);
    }

    return result.slice(0, o);
}

export const QOI = {
    encode,
};

export default {
    ...QOI,
    QOI,
};
