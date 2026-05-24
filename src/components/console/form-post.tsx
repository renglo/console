import { useState,useEffect,useContext } from 'react';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import TagsInput from "@/components/ui/tags-input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"; // Assuming these are the correct imports
import { useToast } from "@/components/ui/use-toast";
import {GlobalContext} from "@/components/console/global-context"


interface FieldDefinition {
    name: string;
    type: 'string' | 'number' | 'timestamp' | 'array' | 'object'; // Added complex types
    label: string;
    required: boolean;
    widget: 'text' | 'date' |'number' | 'select' | 'image' | 'select-cascade' | 'textarray' | 'json'; // Add more widget types as necessary
    hint?: string; // Optional hint for placeholders
    options?: Record<string, string> | Record<string, Record<string, string>>; // select: key-value; select-cascade: outerKey -> key-value
    source?: string; // select-cascade: name of field to watch for outer key
    [key: string]: any; // Additional properties
}

interface RichDefinition {
  [key: string]: {
    [innerKey: string]: string; // All inner values must be strings
  };
}


interface FormField {
    value: any;
    onChange: (value: any) => void;
    [key: string]: any; // Additional form field properties
  }


function generateSchema(fieldArray: FieldDefinition[]): z.ZodObject<any> {
  const formSchemaFields = fieldArray.reduce<Record<string, z.ZodTypeAny>>((schema, field) => {
    let validation: z.ZodTypeAny = z.string();
    if (field.type === "number") {
      validation = z.preprocess(
        (value) => {
          if (value === "" || value === null || value === undefined) return undefined;
          if (typeof value === "number") return value;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? value : parsed;
        },
        z.number()
      );
    }
    if (field.type === "array") {
      validation = z.preprocess(
        (value) => {
          if (value === null || value === undefined || value === "") return [];
          if (Array.isArray(value)) {
            return value
              .map((entry) => String(entry ?? "").trim())
              .filter(Boolean);
          }
          if (typeof value === "string") {
            return value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean);
          }
          return value;
        },
        z.array(z.string())
      );
    }
  
    if (field.required) {
      if (validation instanceof z.ZodString) {
        validation = validation.min(1, { message: `${field.label} is required.` });
      } else if (validation instanceof z.ZodArray) {
        validation = validation.min(1, { message: `${field.label} needs at least one item.` });
      }
    } else {
      validation = validation.optional();
    }
  
    return { ...schema, [field.name]: validation };
  }, {});
  
  return z.object(formSchemaFields);
}




interface FieldOption {
  [key: string]: string;
}

function isCascadeOptions(opts: Record<string, string> | Record<string, Record<string, string>>): opts is Record<string, Record<string, string>> {
  if (!opts || typeof opts !== 'object') return false;
  const firstKey = Object.keys(opts)[0];
  if (firstKey === undefined) return false;
  return typeof opts[firstKey] === 'object' && opts[firstKey] !== null && !Array.isArray(opts[firstKey]);
}

interface Field {
  cardinality: string;
  default: string;
  hint: string;
  id: string;
  label: string;
  layer: string;
  multilingual: boolean;
  name: string;
  order: string;
  required: boolean;
  semantic: string;
  source: string;
  type: string;
  widget: string;
  options?: FieldOption | Record<string, Record<string, string>>; // select: FieldOption; select-cascade: dict of dicts
}

interface Blueprint {
  _id: string;
  added: string;
  blueprint_origin: string;
  description: string;
  fields: Field[];
  handle: string;
  irn: string;
  label: string;
  license: string;
  name: string;
  public: boolean;
  status: string;
  uri: string;
  version: string;
  rich?: {
    [key: string]: {
      [key: string]: string; // Or use any other type if needed
    }
  };
}


interface FormPostProps {
    refreshUp: () => void; 
    blueprint: Blueprint;
    path: string;
    method: string; 
}

  

export default function FormPost({ refreshUp, blueprint, path, method }: FormPostProps) {

  console.log('Blueprint @ FormPost')
  console.log(blueprint);

  
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('No GlobalProvider');
  }
  const { loadTree } = context;
  
  const [Fields, setFields] = useState<FieldDefinition[]>([]);
  const [Rich, setRich] = useState<RichDefinition>({});
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // Get the uploaded file
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      console.log("setting new file");
      setFile(file); // Store the file for uploading via FormData
    } else {
      alert("Please upload a valid image file");
    }

  };
  
  
    
  // Function to render the form field based on the field's widget type
  function renderFormField(field: FieldDefinition, formField: FormField, Rich: RichDefinition, form: { watch: (name: string) => unknown }) {


  
      switch (field.widget) {
        case "text":
          return <Input placeholder={field.hint} {...formField} />;
  
        case "date":
            return <Input type="date" placeholder={field.hint} {...formField} />;
    
        case "number":
          return (
            <Input
              type="number"
              placeholder={field.hint}
              {...formField}
              onChange={(e) => formField.onChange(e.target.value === "" ? undefined : e.target.valueAsNumber)}
              value={formField.value === undefined ? '' : formField.value} // Handle undefined values
            />
          );

        case "textarray":
          return (
            <TagsInput
              value={Array.isArray(formField.value) ? formField.value.map((v) => String(v)) : []}
              onChange={(next) => formField.onChange(next)}
              placeholder={field.hint || "Type and press Enter"}
            />
          );
    
        case "select":
          return (
            <Select onValueChange={formField.onChange} value={formField.value}>
              <SelectTrigger>
                <SelectValue placeholder={field.hint} />
              </SelectTrigger>
  
  
              <SelectContent>
          
                {field.options && !isCascadeOptions(field.options) ? (
                  // If field.options exist, map over the options and display SelectItem components
                  Object.entries(field.options).map(([value, label]) => (
                    <SelectItem key={value} value={value.includes(':') ? value.split(':')[1] : value}>
                      {label}
                    </SelectItem>
                  ))
                ) : (
                  // Else, check if field.rich[field.source.split(':')[1]] exists
                  
                  Rich[(field.source ?? '').split(':')[0]] ? (
                    <>
                      {Object.entries(Rich[(field.source ?? '').split(':')[0]]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    <SelectItem key='x' value='0'>No options</SelectItem>
                  )
  
                  
                )}
  
              </SelectContent>
  
              
  
            </Select>
          );

        case "select-cascade": {
          const sourceName = field.source ?? '';
          const sourceValue = form.watch(sourceName) as string | undefined;
          const cascadeOptions = field.options as Record<string, Record<string, string>> | undefined;
          const innerOptions: Record<string, string> = (sourceValue && cascadeOptions && cascadeOptions[sourceValue])
            ? cascadeOptions[sourceValue]
            : {};
          const placeholder = !sourceValue
            ? `Select ${sourceName} first`
            : (field.hint ?? 'Select...');
          return (
            <Select
              onValueChange={formField.onChange}
              value={innerOptions[formField.value as string] !== undefined ? formField.value : ''}
              disabled={Object.keys(innerOptions).length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(innerOptions).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        case "image":

          return (

            <Input
              type="file"
              placeholder={field.hint}
              accept="image/*" 
              {...formField}
              onChange={(e) => formField.onChange(handleFileChange(e))} // Convert to number
              
            />
          );

    
        // Add more cases for different widget types as needed
    
        default:
          return <Input placeholder={field.hint} {...formField} />;
      }
  }



  useEffect(() => {
      const updateBlueprint = async () => {  
        
          setFields(
            blueprint.fields
              .filter(field => Number(field.layer) <= 0)
              .map(field => ({
                ...field,
                type: field.type as "string" | "number" | "timestamp" | "array" | "object",
                widget: field.widget as "number" | "date" | "select" | "text" | "image" | "select-cascade" | "textarray" | "json",
              }))
          );

    
          // Safely set rich if blueprint.rich exists
          console.log('form-post:235')
          console.log(blueprint);
          if (blueprint.rich) {
            console.log('setRich!'); 
            setRich(blueprint.rich);
          }else{
            console.log('Rich did not exist');
          }

      };
  
      updateBlueprint();
  }, [blueprint]);

  

  const FormSchema = generateSchema(Fields);
  const form = useForm<z.infer<typeof FormSchema>>({
      resolver: zodResolver(FormSchema)
  });

  const formValues = form.watch();
  useEffect(() => {
    Fields.filter(f => f.widget === 'select-cascade' && f.source).forEach(f => {
      const srcVal = formValues[f.source as string];
      const inner = (f.options as Record<string, Record<string, string>>)?.[srcVal as string];
      const currentVal = formValues[f.name];
      if (currentVal && inner && !(currentVal in inner)) {
        form.setValue(f.name, '');
      }
    });
  }, [formValues, Fields, form]);


  // Toast
  const { toast } = useToast();

  async function onSubmit(data: z.infer<typeof FormSchema>) {



      toast({
      title: "You submitted the following values:",
      description: (
          <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
          </pre>
      ),
      });

      
      console.log('Posting ...');
      console.log(data);

      try {

          // Step 1:  Upload File if it exist
          if(file) {

            console.log('Uploading image:')
            console.log(file)

            const formData = new FormData();
            formData.append("up_file", file, file.name);
            formData.append("up_file_type", file.type);
            
            // Append the image file if it exists
            
            //const imageField = data.image; // Assuming 'image' is the name of your file input
            //if (imageField && imageField.length > 0) {
            //    formData.append('image', imageField[0]); // Append the first file
            //}

            const upload_path = path.replace(/_data/g, "_docs");

            // Post the data to your server or API endpoint
            const uploadResponse = await fetch(upload_path, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${sessionStorage.accessToken}`,
              },
              body: formData, // Send FormData instead of JSON
            });

            if (!uploadResponse.ok) {
              throw new Error('File upload failed');
            }
    
            const uploadResult = await uploadResponse.json();

            data['imageurl'] = uploadResult.path


          }


          // Step 2: Submit form with file URL
          // Post the data to your server or API endpoint

          console.log('Posting Form:');
          console.log(data);


          const response = await fetch(path, {
            method: method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionStorage.accessToken}`,
            },
            body: JSON.stringify(data),
          });
    
          // Handle the response
          if (response.ok) {
            console.log('Data submitted successfully!');
            toast({
              title: "Data submitted successfully",
              description: (
                  <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                  <code className="text-white">Data submitted successfully!</code>
                  </pre>
              ),
            });
            
            loadTree();
            refreshUp();
            

          } else {
            console.error('Failed to submit the data.');
            toast({
              title: "Failed to submit the data.",
              description: (
                  <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                  <code className="text-white">Failed to submit the form.</code>
                  </pre>
              ),
            });
          }
        } catch (error) {
          console.error('Error:', error);
          toast({
              title: "Failed to submit the data.",
              description: (
                  <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                  <code className="text-white">Error!</code>
                  </pre>
              ),
            });
      }
  }

  // Component
  return (
      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
          {Fields.map((field) => (
          
          <FormField
              key={field.id}
              control={form.control}
              name={field.name}
              render={({ field: formField }) => (
              <FormItem className="px-1">
                  <FormLabel>{field.label}{field.required ? '*' : ''}</FormLabel>
                  <FormControl>{renderFormField(field, formField, Rich, form)}</FormControl>
                  <FormDescription>{/*<span className='text-xs'>{field.hint}</span>*/}</FormDescription>
                  <FormMessage />
              </FormItem>
              )}
          />
          
          ))}
          <Button key="submit" type="submit">Submit</Button>
      </form>
      </Form>
  );
}