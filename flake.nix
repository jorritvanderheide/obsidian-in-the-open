{
  description = "In the Open Obsidian plugin";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    # The core, for its own checks at the commit this plugin is built with.
    # npm takes the same commit from its GitHub mirror (package.json), and
    # checks.core-pin holds the two together. Update both with:
    # nix flake update citation-core, then
    # npm install git+https://github.com/jorritvanderheide/obsidian-citation-core.git#<rev>
    # With its own nixpkgs, not this one's. The pandoc its tests expect it
    # fetches by URL and hash itself, so that stays the same either way.
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
        inherit (pkgs) lib;
        # The core's commit as npm has it: the part of its address after `#`.
        lock = builtins.fromJSON (builtins.readFile ./package-lock.json);
        npmCore = lib.last (
          lib.splitString "#" lock.packages."node_modules/obsidian-citation-core".resolved
        );
      in
      {
        packages.default = pkgs.buildNpmPackage {
          # Both from package.json, so a rename or a release cannot leave them behind.
          pname = package.name;
          inherit (package) version;
          src = ./.;
          # Update with: nix run nixpkgs#prefetch-npm-deps -- package-lock.json
          npmDepsHash = "sha256-BUCYya1K6Tg8/gIZLaYsJgMXDjJthCO4VtdBZ9cvRag=";
          nodejs = pkgs.nodejs_24;
          # The lint and the tests run with the build, so nix flake check is the
          # whole check.
          doCheck = true;
          checkPhase = ''
            runHook preCheck
            npm run lint
            npm test
            runHook postCheck
          '';
          # npm writes to its cache while it installs the core, a git dependency.
          makeCacheWritable = true;
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
          # npm's core and the flake's are one commit, or the core's checks would
          # pass for code the plugin doesn't bundle.
          core-pin =
            if npmCore == citation-core.rev then
              pkgs.emptyFile
            else
              throw "package-lock.json has the core at ${npmCore}, flake.lock at ${citation-core.rev}: move both to one commit.";
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [ pkgs.nodejs_24 ];
        };
      }
    );
}
