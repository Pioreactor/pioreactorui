# -*- coding: utf-8 -*-
from __future__ import annotations

import typing as t

from msgspec import Struct


class PublishedSettingsDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    key: str
    type: t.Literal["numeric", "boolean", "string", "json"]
    display: bool
    description: str | None = None
    default: str | bool | None = None
    unit: t.Optional[str] = None
    label: t.Optional[str] = None  # if display is false, this isn't needed


class BackgroundJobDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    display_name: str
    job_name: str
    display: bool
    source: str
    published_settings: list[PublishedSettingsDescriptor]
    description: t.Optional[str] = None  # if display is false, this isn't needed
    subtext: t.Optional[str] = None
    is_testing: bool = False


class AutomationPublishedSettingsDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    key: str
    default: str | float | int | None
    unit: str | None
    label: str
    disabled: bool = False


class AutomationDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    display_name: str
    automation_name: str
    description: str
    fields: list[AutomationPublishedSettingsDescriptor]


class ChartDescriptor(Struct, forbid_unknown_fields=True):  # type: ignore
    chart_key: str
    data_source: str  # SQL table
    title: str
    mqtt_topic: str
    source: str
    y_axis_label: str
    lookback: int | str
    fixed_decimals: int
    payload_key: str | None = None
    y_transformation: str | None = "(y) => y"  # default is the identity
    y_axis_domain: list[float] | None = None
    interpolation: t.Literal[
        "basis",
        "bundle",
        "cardinal",
        "catmullRom",
        "linear",
        "monotoneX",
        "monotoneY",
        "natural",
        "step",
        "stepAfter",
        "stepBefore",
    ] = "stepAfter"
