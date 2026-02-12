export const exercises = [
  {
    id: "py_clean_mean",
    topic: "python",
    level: "basico",
    title: "Media de valores validos",
    description:
      "Implementa `media_limpia(valores)` para calcular la media ignorando `None`. Si no hay datos validos, devuelve 0.",
    starterCode: `def media_limpia(valores):\n    # TODO\n    pass\n\nprint(media_limpia([10, None, 20, 30]))`,
    solutionCode: `def media_limpia(valores):\n    limpios = [x for x in valores if x is not None]\n    if not limpios:\n        return 0\n    return sum(limpios) / len(limpios)\n\nprint(media_limpia([10, None, 20, 30]))`,
    testCode: `assert media_limpia([10, None, 20, 30]) == 20\nassert media_limpia([None, None]) == 0\nassert media_limpia([5]) == 5`,
    hints: [
      "Filtra los `None` antes de operar.",
      "Usa una list comprehension.",
      "Controla el caso de lista vacia."
    ],
    failHelp: "Revisa el caso donde todos los elementos son `None`."
  },
  {
    id: "dict_char_count",
    topic: "python",
    level: "intermedio",
    title: "Conteo de caracteres",
    description:
      "Implementa `contar_caracteres(texto)` que devuelva un diccionario con frecuencia de letras (ignora espacios y mayusculas).",
    starterCode: `def contar_caracteres(texto):\n    # TODO\n    pass\n\nprint(contar_caracteres(\"Data\"))`,
    solutionCode: `def contar_caracteres(texto):\n    conteo = {}\n    for c in texto.lower():\n        if c == \" \":\n            continue\n        conteo[c] = conteo.get(c, 0) + 1\n    return conteo\n\nprint(contar_caracteres(\"Data\"))`,
    testCode: `assert contar_caracteres("Data") == {"d": 1, "a": 2, "t": 1}\nassert contar_caracteres("a a") == {"a": 2}`,
    hints: [
      "Convierte a minusculas.",
      "Ignora espacios.",
      "Usa `dict.get` para acumular."
    ],
    failHelp: "Asegurate de no contar espacios y de usar minusculas."
  },
  {
    id: "py_top_unique",
    topic: "python",
    level: "avanzado",
    title: "Top N unicos",
    description:
      "Implementa `top_n_unicos(nums, n)` para devolver los `n` valores unicos mas altos en orden descendente.",
    starterCode: `def top_n_unicos(nums, n):\n    # TODO\n    pass\n\nprint(top_n_unicos([4, 1, 4, 8, 3, 8], 3))`,
    solutionCode: `def top_n_unicos(nums, n):\n    unicos = sorted(set(nums), reverse=True)\n    return unicos[:n]\n\nprint(top_n_unicos([4, 1, 4, 8, 3, 8], 3))`,
    testCode: `assert top_n_unicos([4, 1, 4, 8, 3, 8], 3) == [8, 4, 3]\nassert top_n_unicos([5, 5, 5], 2) == [5]\nassert top_n_unicos([], 4) == []`,
    hints: [
      "Primero elimina duplicados.",
      "Ordena de mayor a menor.",
      "Corta la lista con `[:n]`."
    ],
    failHelp: "Verifica que no se repitan valores y que el orden sea descendente."
  },

  {
    id: "func_apply_twice",
    topic: "funcional",
    level: "basico",
    title: "Funcion de orden superior",
    description: "Crea `apply_twice(fn, x)` que aplique la funcion dos veces sobre `x`.",
    starterCode: `def apply_twice(fn, x):\n    # TODO\n    pass\n\nprint(apply_twice(lambda n: n + 3, 10))`,
    solutionCode: `def apply_twice(fn, x):\n    return fn(fn(x))\n\nprint(apply_twice(lambda n: n + 3, 10))`,
    testCode: `assert apply_twice(lambda n: n + 3, 10) == 16\nassert apply_twice(lambda n: n * 2, 4) == 16`,
    hints: [
      "La salida de la primera llamada es la entrada de la segunda.",
      "Piensa en `fn(fn(x))`."
    ],
    failHelp: "No devuelvas solo una aplicacion de `fn`."
  },
  {
    id: "func_even_square",
    topic: "funcional",
    level: "intermedio",
    title: "Filtrar y cuadrar",
    description:
      "Implementa `filtrar_y_cuadrar(nums)` para devolver el cuadrado de los pares, manteniendo orden.",
    starterCode: `def filtrar_y_cuadrar(nums):\n    # TODO\n    pass\n\nprint(filtrar_y_cuadrar([1, 2, 3, 4, 5]))`,
    solutionCode: `def filtrar_y_cuadrar(nums):\n    return [n * n for n in nums if n % 2 == 0]\n\nprint(filtrar_y_cuadrar([1, 2, 3, 4, 5]))`,
    testCode: `assert filtrar_y_cuadrar([1, 2, 3, 4, 5]) == [4, 16]\nassert filtrar_y_cuadrar([2, 2]) == [4, 4]\nassert filtrar_y_cuadrar([]) == []`,
    hints: [
      "Filtra por paridad (`n % 2 == 0`).",
      "Aplica transformacion solo a los que pasan el filtro."
    ],
    failHelp: "Revisa que mantienes solo pares y que devuelves sus cuadrados."
  },
  {
    id: "func_top_students",
    topic: "funcional",
    level: "avanzado",
    title: "Pipeline de estudiantes",
    description:
      "Implementa `top_estudiantes(students, minimo)` y devuelve nombres con promedio >= `minimo`, ordenados por promedio desc.",
    starterCode: `def top_estudiantes(students, minimo):\n    # TODO\n    pass\n\nstudents = [\n    {\"name\": \"Ana\", \"grades\": [9, 8]},\n    {\"name\": \"Luis\", \"grades\": [5, 6]},\n    {\"name\": \"Marta\", \"grades\": [10, 9]}\n]\nprint(top_estudiantes(students, 8))`,
    solutionCode: `def top_estudiantes(students, minimo):\n    scored = [\n        (s[\"name\"], sum(s[\"grades\"]) / len(s[\"grades\"]))\n        for s in students\n    ]\n    filtered = [x for x in scored if x[1] >= minimo]\n    filtered.sort(key=lambda x: x[1], reverse=True)\n    return [name for name, _ in filtered]\n\nstudents = [\n    {\"name\": \"Ana\", \"grades\": [9, 8]},\n    {\"name\": \"Luis\", \"grades\": [5, 6]},\n    {\"name\": \"Marta\", \"grades\": [10, 9]}\n]\nprint(top_estudiantes(students, 8))`,
    testCode: `students = [\n    {"name": "Ana", "grades": [9, 8]},\n    {"name": "Luis", "grades": [5, 6]},\n    {"name": "Marta", "grades": [10, 9]},\n    {"name": "Leo", "grades": [8, 8]}\n]\nassert top_estudiantes(students, 8) == ["Marta", "Ana", "Leo"]\nassert top_estudiantes(students, 9) == ["Marta"]`,
    hints: [
      "Calcula promedio por estudiante.",
      "Filtra por minimo.",
      "Ordena desc por promedio y devuelve solo nombres."
    ],
    failHelp: "Comprueba el orden final y que aplicas correctamente el umbral minimo."
  },

  {
    id: "err_parse_int",
    topic: "errores",
    level: "basico",
    title: "Parseo seguro de enteros",
    description:
      "Implementa `parse_int_seguro(txt)` que devuelva entero o `None` si no se puede convertir.",
    starterCode: `def parse_int_seguro(txt):\n    # TODO\n    pass\n\nprint(parse_int_seguro(\"42\"))`,
    solutionCode: `def parse_int_seguro(txt):\n    try:\n        return int(txt)\n    except ValueError:\n        return None\n\nprint(parse_int_seguro(\"42\"))`,
    testCode: `assert parse_int_seguro("42") == 42\nassert parse_int_seguro("-8") == -8\nassert parse_int_seguro("hola") is None`,
    hints: [
      "Usa `try/except ValueError`.",
      "Si falla la conversion, devuelve `None`."
    ],
    failHelp: "Revisa el caso en que el texto no representa un entero valido."
  },
  {
    id: "errors_safe_division",
    topic: "errores",
    level: "intermedio",
    title: "Division segura",
    description:
      "Implementa `division_segura(a, b)` que devuelva `a / b` o `\"division_por_cero\"` si `b` es 0.",
    starterCode: `def division_segura(a, b):\n    # TODO\n    pass\n\nprint(division_segura(10, 2))`,
    solutionCode: `def division_segura(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return \"division_por_cero\"\n\nprint(division_segura(10, 2))`,
    testCode: `assert division_segura(10, 2) == 5\nassert division_segura(5, 0) == "division_por_cero"`,
    hints: [
      "Captura `ZeroDivisionError`.",
      "En ese caso devuelve el string exacto pedido."
    ],
    failHelp: "Asegurate de gestionar correctamente la division entre cero."
  },
  {
    id: "err_validar_edad",
    topic: "errores",
    level: "avanzado",
    title: "Validacion con raise",
    description:
      "Implementa `validar_edad(edad)` que devuelva `True` si edad es int entre 0 y 120. Si no, lanza excepcion.",
    starterCode: `def validar_edad(edad):\n    # TODO\n    pass\n\nprint(validar_edad(30))`,
    solutionCode: `def validar_edad(edad):\n    if not isinstance(edad, int):\n        raise TypeError(\"tipo_invalido\")\n    if edad < 0 or edad > 120:\n        raise ValueError(\"edad_invalida\")\n    return True\n\nprint(validar_edad(30))`,
    testCode: `assert validar_edad(30) is True\ntry:\n    validar_edad(-1)\n    assert False\nexcept ValueError:\n    pass\ntry:\n    validar_edad("20")\n    assert False\nexcept TypeError:\n    pass`,
    hints: [
      "Primero valida tipo con `isinstance`.",
      "Despues valida rango.",
      "Usa `raise` para errores invalidos."
    ],
    failHelp: "Debes lanzar `TypeError` para tipo invalido y `ValueError` para rango invalido."
  },

  {
    id: "numpy_center",
    topic: "numpy",
    level: "basico",
    title: "Centrar un array",
    description: "Implementa `centrar(arr)` para restar la media de cada elemento.",
    starterCode: `import numpy as np\n\ndef centrar(arr):\n    # TODO\n    pass\n\nprint(centrar(np.array([2, 4, 6], dtype=float)))`,
    solutionCode: `import numpy as np\n\ndef centrar(arr):\n    return arr - arr.mean()\n\nprint(centrar(np.array([2, 4, 6], dtype=float)))`,
    testCode: `import numpy as np\nout = centrar(np.array([2, 4, 6], dtype=float))\nassert np.allclose(out, np.array([-2, 0, 2], dtype=float))`,
    hints: [
      "La media se obtiene con `arr.mean()`.",
      "Aplica la resta de forma vectorizada."
    ],
    failHelp: "Comprueba que restas la media a todos los elementos del array."
  },
  {
    id: "numpy_zscore",
    topic: "numpy",
    level: "intermedio",
    title: "Normalizacion z-score",
    description: "Escribe `normalizar_zscore(arr)` con formula `(arr - media) / std`.",
    starterCode: `import numpy as np\n\ndef normalizar_zscore(arr):\n    # TODO\n    pass\n\ndatos = np.array([4, 6, 10, 12], dtype=float)\nprint(normalizar_zscore(datos))`,
    solutionCode: `import numpy as np\n\ndef normalizar_zscore(arr):\n    return (arr - arr.mean()) / arr.std()\n\ndatos = np.array([4, 6, 10, 12], dtype=float)\nprint(normalizar_zscore(datos))`,
    testCode: `import numpy as np\nout = normalizar_zscore(np.array([4, 6, 10, 12], dtype=float))\nexpected = np.array([-1.26491106, -0.63245553, 0.63245553, 1.26491106])\nassert np.allclose(out, expected, atol=1e-6)`,
    hints: [
      "No uses bucles.",
      "Necesitas media y desviacion estandar."
    ],
    failHelp: "Revisa la formula de z-score y la desviacion estandar usada."
  },
  {
    id: "numpy_row_normalize",
    topic: "numpy",
    level: "avanzado",
    title: "Normalizar filas",
    description:
      "Implementa `normalizar_filas(mat)` para dividir cada fila por su suma. Si una fila suma 0, dejala en 0.",
    starterCode: `import numpy as np\n\ndef normalizar_filas(mat):\n    # TODO\n    pass\n\nm = np.array([[1, 1], [2, 0], [0, 0]], dtype=float)\nprint(normalizar_filas(m))`,
    solutionCode: `import numpy as np\n\ndef normalizar_filas(mat):\n    row_sums = mat.sum(axis=1, keepdims=True)\n    return np.divide(mat, row_sums, out=np.zeros_like(mat, dtype=float), where=row_sums != 0)\n\nm = np.array([[1, 1], [2, 0], [0, 0]], dtype=float)\nprint(normalizar_filas(m))`,
    testCode: `import numpy as np\nm = np.array([[1, 1], [2, 0], [0, 0]], dtype=float)\nout = normalizar_filas(m)\nexpected = np.array([[0.5, 0.5], [1.0, 0.0], [0.0, 0.0]])\nassert np.allclose(out, expected)`,
    hints: [
      "Suma por filas con `axis=1`.",
      "Usa `keepdims=True` para broadcasting.",
      "Controla filas con suma 0."
    ],
    failHelp: "Asegurate de no dividir por cero en filas vacias."
  },

  {
    id: "pandas_total_sales",
    topic: "pandas",
    level: "basico",
    title: "Suma de ventas",
    description: "Implementa `total_ventas(df)` que devuelva la suma de la columna `ventas`.",
    resources: [
      {
        name: "ventas.csv",
        type: "csv",
        content: "id,ventas\n1,100\n2,40\n3,60\n4,25\n"
      }
    ],
    starterCode: `import pandas as pd\n\ndef total_ventas(df):\n    # TODO\n    pass\n\ndf = pd.DataFrame({\"ventas\": [100, 40, 60]})\nprint(total_ventas(df))`,
    solutionCode: `import pandas as pd\n\ndef total_ventas(df):\n    return df[\"ventas\"].sum()\n\ndf = pd.DataFrame({\"ventas\": [100, 40, 60]})\nprint(total_ventas(df))`,
    testCode: `import pandas as pd\nassert total_ventas(pd.DataFrame({"ventas": [100, 40, 60]})) == 200\nassert total_ventas(pd.DataFrame({"ventas": []})) == 0`,
    hints: [
      "Selecciona la columna `ventas`.",
      "Aplica el metodo `sum()`."
    ],
    failHelp: "Revisa que devuelves un numero y no una serie."
  },
  {
    id: "pandas_groupby",
    topic: "pandas",
    level: "intermedio",
    title: "Groupby de ventas",
    description:
      "Implementa `resumen_ventas(df)` para devolver columnas `categoria` y `venta_media` ordenadas descendentemente.",
    resources: [
      {
        name: "ventas_categorias.csv",
        type: "csv",
        content: "categoria,ventas\nA,100\nA,80\nB,200\nB,160\nC,50\n"
      }
    ],
    starterCode: `import pandas as pd\n\ndef resumen_ventas(df):\n    # TODO\n    pass\n\ndf = pd.DataFrame({\n    \"categoria\": [\"A\", \"A\", \"B\", \"B\", \"C\"],\n    \"ventas\": [100, 80, 200, 160, 50]\n})\nprint(resumen_ventas(df))`,
    solutionCode: `import pandas as pd\n\ndef resumen_ventas(df):\n    out = df.groupby(\"categoria\", as_index=False)[\"ventas\"].mean()\n    out = out.rename(columns={\"ventas\": \"venta_media\"})\n    return out.sort_values(\"venta_media\", ascending=False).reset_index(drop=True)\n\ndf = pd.DataFrame({\n    \"categoria\": [\"A\", \"A\", \"B\", \"B\", \"C\"],\n    \"ventas\": [100, 80, 200, 160, 50]\n})\nprint(resumen_ventas(df))`,
    testCode: `import pandas as pd\ntest = pd.DataFrame({\n    "categoria": ["A", "A", "B", "B", "C"],\n    "ventas": [100, 80, 200, 160, 50]\n})\nout = resumen_ventas(test)\nassert list(out.columns) == ["categoria", "venta_media"]\nassert out.iloc[0]["categoria"] == "B"\nassert float(out.iloc[0]["venta_media"]) == 180.0`,
    hints: [
      "Agrupa por `categoria`.",
      "Calcula media y renombra la columna.",
      "Ordena de mayor a menor."
    ],
    failHelp: "Comprueba nombres de columnas y orden final."
  },
  {
    id: "pandas_merge_fact",
    topic: "pandas",
    level: "avanzado",
    title: "Merge para tabla analitica",
    description:
      "Implementa `construir_fact(transactions, products)` para unir por `product_id` (left join) y crear `importe = qty * base_price`.",
    resources: [
      {
        name: "transactions.csv",
        type: "csv",
        content: "product_id,qty\n1,2\n1,3\n2,1\n"
      },
      {
        name: "products.json",
        type: "json",
        content:
          "[{\"product_id\": 1, \"base_price\": 10.0}, {\"product_id\": 2, \"base_price\": 20.0}]"
      }
    ],
    starterCode: `import pandas as pd\n\ndef construir_fact(transactions, products):\n    # TODO\n    pass\n\ntransactions = pd.DataFrame({\n    \"product_id\": [1, 1, 2],\n    \"qty\": [2, 3, 1]\n})\nproducts = pd.DataFrame({\n    \"product_id\": [1, 2],\n    \"base_price\": [10.0, 20.0]\n})\nprint(construir_fact(transactions, products))`,
    solutionCode: `import pandas as pd\n\ndef construir_fact(transactions, products):\n    fact = pd.merge(transactions, products, on=\"product_id\", how=\"left\")\n    fact[\"importe\"] = fact[\"qty\"] * fact[\"base_price\"]\n    return fact\n\ntransactions = pd.DataFrame({\n    \"product_id\": [1, 1, 2],\n    \"qty\": [2, 3, 1]\n})\nproducts = pd.DataFrame({\n    \"product_id\": [1, 2],\n    \"base_price\": [10.0, 20.0]\n})\nprint(construir_fact(transactions, products))`,
    testCode: `import pandas as pd\ntx = pd.DataFrame({\n    "product_id": [1, 1, 2],\n    "qty": [2, 3, 1]\n})\npr = pd.DataFrame({\n    "product_id": [1, 2],\n    "base_price": [10.0, 20.0]\n})\nout = construir_fact(tx, pr)\nassert out.shape[0] == 3\nassert list(out.columns) == ["product_id", "qty", "base_price", "importe"]\nassert float(out.loc[0, "importe"]) == 20.0\nassert float(out.loc[2, "importe"]) == 20.0`,
    hints: [
      "Haz `merge` por `product_id`.",
      "Usa `how='left'`.",
      "Crea columna calculada `importe`."
    ],
    failHelp: "Revisa tipo de join y nombre de columna calculada."
  },

  {
    id: "poo_cuenta",
    topic: "poo",
    level: "basico",
    title: "Clase Cuenta",
    description:
      "Crea clase `Cuenta` con atributo `saldo`, metodo `depositar(cantidad)` y `retirar(cantidad)`.",
    starterCode: `class Cuenta:\n    # TODO\n    pass\n\nc = Cuenta(100)\nc.depositar(50)\nc.retirar(30)\nprint(c.saldo)`,
    solutionCode: `class Cuenta:\n    def __init__(self, saldo):\n        self.saldo = saldo\n\n    def depositar(self, cantidad):\n        self.saldo += cantidad\n\n    def retirar(self, cantidad):\n        self.saldo -= cantidad\n\nc = Cuenta(100)\nc.depositar(50)\nc.retirar(30)\nprint(c.saldo)`,
    testCode: `c = Cuenta(100)\nc.depositar(50)\nc.retirar(30)\nassert c.saldo == 120`,
    hints: [
      "Define `__init__` para inicializar saldo.",
      "`depositar` suma, `retirar` resta."
    ],
    failHelp: "Asegurate de actualizar `self.saldo` en ambos metodos."
  },
  {
    id: "poo_rectangulo",
    topic: "poo",
    level: "intermedio",
    title: "Clase Rectangulo",
    description: "Crea clase `Rectangulo` con `area()` y `perimetro()`.",
    starterCode: `class Rectangulo:\n    # TODO\n    pass\n\nr = Rectangulo(4, 3)\nprint(r.area(), r.perimetro())`,
    solutionCode: `class Rectangulo:\n    def __init__(self, base, altura):\n        self.base = base\n        self.altura = altura\n\n    def area(self):\n        return self.base * self.altura\n\n    def perimetro(self):\n        return 2 * (self.base + self.altura)\n\nr = Rectangulo(4, 3)\nprint(r.area(), r.perimetro())`,
    testCode: `r = Rectangulo(4, 3)\nassert r.area() == 12\nassert r.perimetro() == 14`,
    hints: [
      "Area = base * altura.",
      "Perimetro = 2 * (base + altura)."
    ],
    failHelp: "Revisa formulas de area y perimetro."
  },
  {
    id: "poo_tienda",
    topic: "poo",
    level: "avanzado",
    title: "Clase Tienda",
    description:
      "Crea una clase `Tienda` con atributos `nombre`, `ventas` (lista) y metodos `media_ventas()` y `venta_total()`.",
    starterCode: `class Tienda:\n    # TODO\n    pass\n\nt = Tienda(\"Centro\", [100, 120, 80])\nprint(t.media_ventas(), t.venta_total())`,
    solutionCode: `class Tienda:\n    def __init__(self, nombre, ventas):\n        self.nombre = nombre\n        self.ventas = ventas\n\n    def media_ventas(self):\n        return sum(self.ventas) / len(self.ventas) if self.ventas else 0\n\n    def venta_total(self):\n        return sum(self.ventas)\n\nt = Tienda(\"Centro\", [100, 120, 80])\nprint(t.media_ventas(), t.venta_total())`,
    testCode: `t = Tienda("Centro", [100, 120, 80])\nassert t.media_ventas() == 100\nassert t.venta_total() == 300\nassert Tienda("Vacia", []).media_ventas() == 0`,
    hints: [
      "Define constructor con `__init__`.",
      "Controla lista vacia en la media.",
      "Suma ventas para total."
    ],
    failHelp: "Comprueba metodos y casos borde como lista vacia."
  }
];

export const topicLabels = {
  python: "Python",
  funcional: "Programacion Funcional",
  errores: "Manejo de Errores",
  numpy: "NumPy",
  pandas: "Pandas",
  poo: "POO"
};

export const levelLabels = {
  basico: "Basico",
  intermedio: "Intermedio",
  avanzado: "Avanzado"
};

export const difficultyRank = {
  basico: 1,
  intermedio: 2,
  avanzado: 3
};
