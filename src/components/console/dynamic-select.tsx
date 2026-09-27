import React, { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"; 

interface DynamicSelectProps {
  label?: string;
  hint?: string;
  source: string; // The source prop in the format "x:y:z"
  portfolio_id: string;
  org_id: string;
  onValueChange: (value: string) => void; // Callback prop to pass value to parent
  default_value?: string;
  /** Read Dynamo pages instead of the S3 list snapshot. */
  live?: boolean;
}

interface ApiResponseItem {
  [key: string]: string | number; // A generic object representing the API response items
}

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const DynamicSelect: React.FC<DynamicSelectProps> = ({ label, hint, source, portfolio_id, org_id, onValueChange, default_value, live }) => {
  const [options, setOptions] = useState<ApiResponseItem[]>([]); // State to hold the fetched options
  const [loading, setLoading] = useState<boolean>(true); // Loading state
  const [error, setError] = useState<string | null>(null); // Error state
  const [selectedValue, setSelectedValue] = useState<string | number>(""); // State to hold selected value
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const appliedDefault = useRef<string | null>(null);


  // 1. Check if default_value is a UUID
  // 2. If yes, replace its value with ut


  // Split the source prop to extract x, y, z
  const [resource, valueField, labelField] = source.split(":");


  useEffect(() => {
    // Function to fetch data from the API endpoint
    const fetchData = async () => {
      try {
        setLoading(true); // Set loading to true when fetching data

        const headers = {
          Authorization: `Bearer ${sessionStorage.accessToken}`,
        };
        let data: ApiResponseItem[] = [];
        if (live) {
          // Same source as the ring table: Dynamo pages, not the S3 snapshot.
          let lastkey: string | null = null;
          const seen = new Set<string>();
          while (seen.size < 20) {
            const params = new URLSearchParams({ paged: "1", limit: "500" });
            if (lastkey) params.set("lastkey", lastkey);
            const dataResponse = await fetch(
              `${import.meta.env.VITE_API_URL}/_data/${portfolio_id}/${org_id}/${resource}?${params}`,
              { method: "GET", headers },
            );
            if (!dataResponse.ok) {
              throw new Error("Failed to fetch options");
            }
            const body = await dataResponse.json();
            const page = Array.isArray(body?.items) ? body.items : [];
            data = data.concat(page);
            const next = body?.last_id ? String(body.last_id) : "";
            if (!next || seen.has(next)) break;
            seen.add(next);
            lastkey = next;
          }
        } else {
          const dataResponse = await fetch(`${import.meta.env.VITE_API_URL}/_data/${portfolio_id}/${org_id}/${resource}`, {
            method: "GET",
            headers,
          });

          if (!dataResponse.ok) {
            throw new Error("Failed to fetch options");
          }
          const body = await dataResponse.json();
          data = Array.isArray(body?.items) ? body.items : [];
        }

        data = data.filter((item) => item && item[valueField] != null && String(item[valueField]) !== "");
        data.sort((a, b) => {
          const labelA = String(a[labelField] ?? "").toLowerCase();
          const labelB = String(b[labelField] ?? "").toLowerCase();
          return labelA.localeCompare(labelB);
        });

        setOptions(data); // Set the sorted options in state
        console.log('options:',data);
        //if (data.length > 0) {
          //handleValueChange (String(data[0][valueField]));
        //  console.log('set select value:',String(data[0][valueField]));
        //}
      } catch (err) {
        setError("Error fetching data");
        console.error(err);
      } finally {
        setLoading(false); // Stop loading once the fetch is complete
      }
    };

    fetchData(); // Fetch data on component mount
  }, [resource, valueField, labelField, portfolio_id, org_id, live]);

  // A UUID default is a real selection, not only a placeholder label.
  useEffect(() => {
    if (!default_value || !isUUID(default_value)) return;
    if (!options.some((item) => String(item[valueField]) === default_value)) return;
    if (appliedDefault.current === default_value) return;
    appliedDefault.current = default_value;
    setSelectedValue(default_value);
    onValueChangeRef.current(default_value);
  }, [default_value, options, valueField]);

  // Handle selection change and call the parent's onValueChange
  const handleValueChange = (value: string) => {
    setSelectedValue(value);
    onValueChange(value); // Pass selected value up to parent component
  };

  // Function to get the label by id
  const getLabelById = (id: string) => {
    const option = options.find(item => item[valueField] === id);
    return option ? option[labelField] : undefined; // Return the label or undefined if not found
  };

  let initialLabel; // Declare initialLabel outside the condition
  if (default_value) {
    if (isUUID(default_value)) {
      initialLabel = getLabelById(default_value);
    } else {
      initialLabel = String(default_value);
    }
  }


  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      {hint && <p className="hint">{hint}</p>}
      <Select
        name={label}
        value={selectedValue ? String(selectedValue) : undefined}
        onValueChange={handleValueChange} // Use onValueChange instead of onChange
      >
        <SelectTrigger>
          <SelectValue placeholder={initialLabel} />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item[valueField] as string} value={String(item[valueField])}>
              {label}: {item[labelField]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DynamicSelect;