{
  "targets": [
    {
      "target_name": "shuffle_addon",
      "sources": [ "shuffle_addon.cpp" ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "conditions": [
        ["OS==\'win'", { "msvs_disabled_warnings": ["4996"] }]
      ]
    }
  ]
}
