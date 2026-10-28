{
  description = "In the Open Obsidian plugin";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # The core, which npm takes from the checkout next to this one
    # (`file:../obsidian-citation-core`). This pins the commit a release is
    # built from; CI checks out the same one. Update with:
    # nix flake update citation-core
    # With its own nixpkgs, not this one's, so its tests run with the pandoc
    # they were written against.
    citation-core.url = "git+https://codeberg.org/BW20/obsidian-citation-core";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      citation-core,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        package = builtins.fromJSON (builtins.readFile ./package.json);
      in
      {
        packages.default = pkgs.buildNpmPackage {
          # Both from package.json, so a rename or a release cannot leave them behind.
          pname = package.name;
          inherit (package) version;
          src = ./.;
          # Where `file:../obsidian-citation-core` looks, next to the source.
          postUnpack = ''
            cp -r ${citation-core} obsidian-citation-core
            chmod -R u+w obsidian-citation-core
          '';
          # Update with: nix run nixpkgs#prefetch-npm-deps -- package-lock.json
          npmDepsHash = "sha256-pber3OA+/+Rgi4yhSXMdvvAtKgAOJX40VwfIOWKaGMs=";
          nodejs = pkgs.nodejs_24;
          installPhase = ''
            mkdir -p $out
            cp main.js manifest.json styles.css $out/
          '';
        };

        # CI runs nix flake check, which builds this, so npmDepsHash can't fall
        # behind package-lock.json unnoticed. The core's own checks, its tests
        # with pandoc among them, run too, at the commit this plugin is built
        # from.
        checks = {
          default = self.packages.${system}.default;
          core = citation-core.checks.${system}.default;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [ pkgs.nodejs_24 ];
        };
      }
    );
}
