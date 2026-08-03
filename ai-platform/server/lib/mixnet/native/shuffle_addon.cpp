#include <napi.h>
#include <random>
#include <chrono>

using namespace Napi;

static void FisherYatesShuffle(uint32_t* data, size_t n, uint64_t seed) {
  std::mt19937_64 rng(seed);
  for (size_t i = n; i > 1; --i) {
    std::uniform_int_distribution<uint64_t> dist(0, i - 1);
    size_t j = static_cast<size_t>(dist(rng));
    uint32_t tmp = data[i-1];
    data[i-1] = data[j];
    data[j] = tmp;
  }
}

Value Shuffle(const CallbackInfo& info) {
  Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsTypedArray()) {
    TypeError::New(env, "Expected a Uint32Array as first argument").ThrowAsJavaScriptException();
    return env.Null();
  }

  TypedArray ta = info[0].As<TypedArray>();
  if (ta.TypedArrayType() != napi_uint32_array) {
    TypeError::New(env, "Expected a Uint32Array").ThrowAsJavaScriptException();
    return env.Null();
  }

  TypedArrayOf<uint32_t> arr = info[0].As<TypedArrayOf<uint32_t>>();
  size_t length = arr.ElementLength();
  uint32_t* data = arr.Data();

  uint64_t seed = 0;
  if (info.Length() >= 2) {
    if (info[1].IsNumber()) seed = static_cast<uint64_t>(info[1].As<Number>().Int64Value());
  }
  if (seed == 0) {
    seed = static_cast<uint64_t>(std::chrono::high_resolution_clock::now().time_since_epoch().count());
  }

  // perform in-place Fisher-Yates
  FisherYatesShuffle(data, length, seed);

  return env.Undefined();
}

Object Init(Env env, Object exports) {
  exports.Set("shuffle", Function::New(env, Shuffle));
  return exports;
}

NODE_API_MODULE(shuffle_addon, Init)
