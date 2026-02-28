import pandas as pd

df = pd.read_excel('c:\\PROJE\\optiplan360_project\\Excel_sablon.xlsx', header=None)
print("--- TEMPLATE HEAD ---")
print(df.head(15).to_string())
print("--- END TEMPLATE ---")
