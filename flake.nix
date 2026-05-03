{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{ flake-parts, treefmt-nix, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        treefmt-nix.flakeModule
      ];

      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      perSystem =
        { pkgs, ... }:
        {
          treefmt = {
            projectRootFile = "hugo.toml";
            programs = {
              nixfmt.enable = true;
              prettier = {
                enable = true;
                settings = {
                  tabWidth = 2;
                };
                includes = [
                  "*.js"
                  "*.css"
                  "*.scss"
                  "*.json"
                  "*.md"
                  "*.yaml"
                  "*.yml"
                ];
              };
              taplo.enable = true;
            };
          };

          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              hugo
            ];
          };
        };
    };
}
