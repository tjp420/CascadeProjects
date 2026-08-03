// Minimal N-API addon: in-place 64-bit sequential squaring prototype
// Operates on a Node Buffer (zero-copy) and repeatedly squares each 64-bit lane.
// This is a prototype for a SIMD-friendly hot path; production will replace
// the word-width math with multi-precision group ops.

#include <node_api.h>
#include <stdint.h>
#include <string.h>

static napi_value squaring_inplace(napi_env env, napi_callback_info info) {
    size_t argc = 2;
    napi_value args[2];
    napi_status status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    if (status != napi_ok) return NULL;

    if (argc < 2) {
        napi_throw_type_error(env, NULL, "Expected (iterations: number, buffer: Buffer)");
        return NULL;
    }

    // iterations
    int64_t iterations = 0;
    status = napi_get_value_int64(env, args[0], &iterations);
    if (status != napi_ok || iterations < 0) {
        napi_throw_type_error(env, NULL, "iterations must be a non-negative integer");
        return NULL;
    }

    // buffer (expect Node Buffer -> ArrayBuffer external)
    bool is_buffer = false;
    status = napi_is_buffer(env, args[1], &is_buffer);
    if (status != napi_ok || !is_buffer) {
        napi_throw_type_error(env, NULL, "second argument must be a Buffer");
        return NULL;
    }

    void* data = NULL;
    size_t length = 0;
    status = napi_get_buffer_info(env, args[1], &data, &length);
    if (status != napi_ok) return NULL;

    // operate on 64-bit lanes; require multiple of 8 bytes
    if (length % 8 != 0) {
        napi_throw_range_error(env, NULL, "buffer length must be divisible by 8");
        return NULL;
    }

    uint64_t* lanes = (uint64_t*)data;
    size_t lanes_count = length / 8;

    // Simple sequential squaring loop (truncating to 64 bits). This is intentionally
    // straightforward so we can later replace the inner math with SIMD or multi-precision.
    for (int64_t iter = 0; iter < iterations; ++iter) {
        for (size_t i = 0; i < lanes_count; ++i) {
            // 128-bit multiply then truncate to low 64 bits
            unsigned __int128 x = (unsigned __int128)lanes[i];
            x = x * x;
            lanes[i] = (uint64_t)x;
        }
    }

    // return the same Buffer object
    return args[1];
}

static napi_value Init(napi_env env, napi_value exports) {
    napi_status status;
    napi_value fn;
    status = napi_create_function(env, "squaring_inplace", NAPI_AUTO_LENGTH, squaring_inplace, NULL, &fn);
    if (status != napi_ok) return NULL;
    status = napi_set_named_property(env, exports, "squaring_inplace", fn);
    if (status != napi_ok) return NULL;
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
