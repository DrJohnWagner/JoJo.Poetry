#set page(
    paper: "{{ paper }}",
    margin: {{ margin }},
)

#set text(
    font: "{{ font }}",
    size: {{ font_size }},
    fill: rgb("{{ colour }}"),
)

#align(center)[
    #text(size: 18pt)[
        {{ title }}
    ]

    #v(0.5em)

    {{ author }}
]

#v(2em)

#columns(
    {{ columns }},
    gutter: {{ gutter }},
)[
```text
{{ body }}
```
]
