# 🎨 Code Style Guidelines

## Critical Style Rules

### 1. Maximum Line Length: 120 Characters
```python
# ❌ BAD - Line too long
def process_large_dataset_with_multiple_parameters_and_complex_logic(
data, param1, param2, param3, param4, param5, param6):    return result

# ✅ GOOD - Properly formatted
def process_large_dataset_with_multiple_parameters_and_complex_logic(
data, param1, param2, param3, param4, param5, param6
):
return result
```

### 2. Long Return Statements
```python
# ❌ BAD - Long return statement
return very_long_variable_name + another_long_variable + complex_calculation(
    param1, param2)

# ✅ GOOD - Multi-line return
return (
very_long_variable_name + another_long_variable +
complex_calculation(param1, param2)
)
```

### 3. Long Assignments
```python
# ❌ BAD - Long assignment
very_long_variable_name = complex_function_call(parameter1,
    parameter2, parameter3, parameter4)

# ✅ GOOD - Multi-line assignment
very_long_variable_name = (
complex_function_call(
parameter1, parameter2, parameter3, parameter4
)
)
```

### 4. Long Import Statements
```python
# ❌ BAD - Long import
from very_long_module_name import very_long_function_name,
    another_long_function_name, third_long_function_name

# ✅ GOOD - Multi-line import
from very_long_module_name import (
very_long_function_name,
another_long_function_name,
third_long_function_name
)
```

### 5. Long List/Dict Definitions
```python
# ❌ BAD - Long list definition
my_list = [item1, item2, item3, item4, item5, item6, item7, item8, item9, item10]

# ✅ GOOD - Multi-line list
my_list = [
item1, item2, item3, item4, item5,
item6, item7, item8, item9, item10
]
```

## Implementation Checklist

- [ ] Fix all lines longer than 120 characters
- [ ] Use consistent indentation for multi-line statements
- [ ] Break long function definitions across lines
- [ ] Format long return statements properly
- [ ] Use multi-line imports for many items
- [ ] Format collections (lists/dicts) across multiple lines

## Style Best Practices

1. **Consistency**: Use the same formatting style throughout
2. **Readability**: Prioritize readability over brevity
3. **Indentation**: Use 4 spaces for indentation
4. **Line Breaks**: Break at logical points (commas, operators)
5. **Alignment**: Align continuation lines properly
6. **Documentation**: Add comments for complex formatting
