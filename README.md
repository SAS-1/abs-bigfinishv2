# abs-bigfinishv2

A metadata provider server for [Audiobookshelf](https://github.com/advplyr/audiobookshelf). Forked from [Vito0912/abs-agg](https://github.com/Vito0912/abs-agg)

This version uses series mapping and characters as tags.

## Quick Start

### Using Docker (recommended)

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/SAS-1/abs-bigfinishv2:latest
```

Or with docker-compose:

See [docker-compose.yml](docker-compose.yml).

## Audiobookshelf Setup

1) Log in to Audiobookshelf as an Administrator.
2) Go to Settings.
3) Select Item Metadata Utils from the menu.
4) Select Custom Metadata Providers.
5) Click Add.

Enter the following details:

| Field | Value                       |
| ----- | --------------------------- |
| Name  | Big Finish                  |
| URL   | `http://192.168.0.100:7777` |


Replace the example IP address with the IP address or hostname of your Docker host.

1) Click Save.
2) Go to your library.
3) Select an audiobook.
4) Click Edit → Match.
5) Under Provider, select your new Big Finish metadata source.
6) Click Search.
7) Select the correct result.
8) Verify the metadata and click Save.

## Environment Variables for Bigfinish

This has 2 new environment variables, disabled by default. 

SERIESMAPPING
CHARACTERS

If these are set to TRUE then it will pull some extra data in, characters will be added as tags in ABS and the series mapping is set to try and improve the Big Finish series info into a better structure for use in ABS. 